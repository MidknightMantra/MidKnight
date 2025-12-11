/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Main Entry Point
   Professional WhatsApp Bot with Port Binding for Deployments
   ═══════════════════════════════════════════════════════════════ */

import 'dotenv/config';
import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import express from 'express';
import { existsSync, mkdirSync } from 'fs';

import config from './src/config.js';
import { initSession } from './src/session.js';
import pluginManager from './src/pluginManager.js';
import { handleMessage, handleGroupUpdate } from './src/messageHandler.js';
import { log } from './src/utils/logger.js';
import db from './src/database.js';
import { initSentry } from './src/monitoring/sentry.js';
import { setupGlobalErrorHandlers } from './src/monitoring/errorHandler.js';
import { startMemoryMonitoring, startMetricsLogging } from './src/monitoring/metrics.js';
import { logSystemEvent } from './src/monitoring/requestLogger.js';

async function start() {
    log.info('Starting Midknight Bot...');

    // Load Plugins
    await pluginManager.loadPlugins();
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZE MONITORING
// ═══════════════════════════════════════════════════════════════
initSentry();
setupGlobalErrorHandlers();
startMemoryMonitoring();
startMetricsLogging();

// ═══════════════════════════════════════════════════════════════
// WEB SERVER (For Port Binding & Keep-Alive)
// ═══════════════════════════════════════════════════════════════
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send({ status: 'online', bot: 'Midknight', uptime: process.uptime() });
});

app.listen(PORT, () => {
    log.info(`Server listening on port ${PORT}`);
});

// ═══════════════════════════════════════════════════════════════
// BOT LOGIC
// ═══════════════════════════════════════════════════════════════

// Suppress Baileys verbose logging
const logger = pino({ level: 'silent' });

// Global bot reference
global.MIDKNIGHT = {
    startTime: Date.now(),
    pluginManager: null,
    sock: null
};

// Also support legacy MIDKNIGHT global for plugin compatibility
global.MIDKNIGHT = global.MIDKNIGHT;

/**
 * Print startup banner
 */
function printBanner() {
    console.log('\x1b[35m');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   ╔╦╗╦╔╦╗╦╔═╔╗╔╦╔═╗╦ ╦╔╦╗');
    console.log('   ║║║║ ║║╠╩╗║║║║║ ╦╠═╣ ║ ');
    console.log('   ╩ ╩╩═╩╝╩ ╩╝╚╝╩╚═╝╩ ╩ ╩ ');
    console.log('   Midknight Bot v1.0.0');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\x1b[0m');
}

/**
 * Start the WhatsApp connection
 */
async function startBot() {
    printBanner();
    logSystemEvent('bot_startup', { version: '1.0.0', mode: config.mode });

    // Connect to Database
    await db.connect();

    // Ensure session directory exists
    if (!existsSync(config.sessionDir)) {
        mkdirSync(config.sessionDir, { recursive: true });
    }

    // Check for SESSION_ID and restore if present
    await initSession();

    // Load plugins
    await pluginManager.loadAll();
    global.MIDKNIGHT.pluginManager = pluginManager;
    logSystemEvent('plugins_loaded', { count: pluginManager.count });

    // Get latest Baileys version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    log.info(`Using WA v${version.join('.')} ${isLatest ? '(latest)' : ''}`);

    // Initialize auth state
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);

    // Create socket connection
    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: false, // We'll handle QR ourselves
        logger,
        browser: ['Midknight', 'Chrome', '120.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    global.MIDKNIGHT.sock = sock;

    // ═══════════════════════════════════════════════════════════════
    // CONNECTION UPDATES
    // ═══════════════════════════════════════════════════════════════
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Display QR Code
        if (qr) {
            console.log('\n📱 Scan this QR code with WhatsApp:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n💡 Tip: After connecting, note down your SESSION_ID for deployment\n');
        }

        // Connection closed
        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            log.warn(`Connection closed. Status: ${statusCode}`);

            if (statusCode === DisconnectReason.loggedOut) {
                log.error('Session logged out. Please delete session folder and restart.');
                process.exit(1);
            }

            if (shouldReconnect) {
                log.info('Reconnecting in 3 seconds...');
                setTimeout(startBot, 3000);
            }
        }

        // Connection opened
        if (connection === 'open') {
            log.success('Connected to WhatsApp!');
            log.info(`Bot: ${sock.user?.id}`);
            log.info(`Loaded: ${pluginManager.count} plugins`);
            log.info(`Prefix: ${config.prefix}`);

            // ═══════════════════════════════════════════════════════════════
            // AUTO-JOIN / AUTO-FOLLOW LOGIC
            // ═══════════════════════════════════════════════════════════════

            // 1. Auto-Join Group
            if (config.autoJoinGroupUrl) {
                try {
                    const code = config.autoJoinGroupUrl.split('chat.whatsapp.com/')[1] || config.autoJoinGroupUrl;
                    log.info(`Attempting to join support group (Code: ${code})...`);
                    await sock.groupAcceptInvite(code);
                    log.success('✅ joined support group!');
                } catch (err) {
                    log.warn(`Failed to join support group: ${err.message}`);
                }
            }

            // 2. Auto-Follow Channel
            if (config.autoFollowChannelUrl) {
                try {
                    // Extract code if it's a URL, otherwise assume JID/Code
                    const channelCode = config.autoFollowChannelUrl.split('whatsapp.com/channel/')[1] || config.autoFollowChannelUrl;

                    if (sock.newsletterFollow) {
                        // Convert Invite Code to JID if necessary (requires metadata fetch)
                        // For now, if the user puts the JID directly (123@newsletter), use it.
                        // If they put a link, we need to fetch metadata first.

                        let jidToFollow = channelCode;
                        if (!channelCode.includes('@newsletter')) {
                            // It's likely a code/link, resolve it
                            try {
                                const metadata = await sock.newsletterMetadata('invite', channelCode);
                                jidToFollow = metadata.id;
                            } catch (e) {
                                log.warn('Could not resolve channel code, trying as is...');
                            }
                        }

                        log.info(`Attempting to follow channel (${jidToFollow})...`);
                        await sock.newsletterFollow(jidToFollow);
                        log.success('✅ Followed announcement channel!');
                    } else {
                        log.warn('This Baileys version does not support newsletterFollow');
                    }
                } catch (err) {
                    log.warn(`Failed to follow channel: ${err.message}`);
                }
            }
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // CREDENTIALS UPDATE
    // ═══════════════════════════════════════════════════════════════
    sock.ev.on('creds.update', saveCreds);

    // ═══════════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════════
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            // Skip messages without content or from self
            if (!msg.message) continue;
            // Delegated to messageHandler logic for processSelfMessages check

            // Handle message
            await handleMessage(sock, msg);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // GROUP PARTICIPANT UPDATES
    // ═══════════════════════════════════════════════════════════════
    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupUpdate(sock, update);
    });

    // ═══════════════════════════════════════════════════════════════
    // CALL HANDLING (Anti-Call if enabled)
    // ═══════════════════════════════════════════════════════════════
    sock.ev.on('call', async (calls) => {
        if (!config.antiCall) return;

        for (const call of calls) {
            if (call.status === 'offer') {
                log.info(`Rejecting call from ${call.from}`);
                await sock.rejectCall(call.id, call.from);
                await sock.sendMessage(call.from, {
                    text: '📵 *Auto-Reject*\n\nI do not accept calls. Please send a message instead.'
                });
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    log.error('Uncaught Exception', { error: err.message });
});

process.on('unhandledRejection', (err) => {
    log.error('Unhandled Rejection', { error: err.message });
});

// Start the bot
startBot().catch((err) => {
    log.error('Startup failed', { error: err.message });
    process.exit(1);
});
