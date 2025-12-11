import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { getBotJid } from '../src/utils/jid.js';

/* -------------------------------------------------------
   CONFIG & HELPERS
------------------------------------------------------- */
const CONFIG_DIR = path.join(process.cwd(), 'data/session/config');
const CFG_PATH = path.join(CONFIG_DIR, 'antiviewonce.json');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

// In-memory cache
let _cache = null;

function updateConfig(jid, data) {
    if (!_cache) _cache = loadConfig();
    _cache[jid] = { ...(_cache[jid] || {}), ...data };
    fs.writeFileSync(CFG_PATH, JSON.stringify(_cache, null, 2));
}

function loadConfig() {
    if (_cache) return _cache;
    try {
        _cache = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
    } catch {
        _cache = {};
    }
    return _cache;
}

async function downloadMedia(mediaMsg, type) {
    try {
        const stream = await downloadContentFromMessage(mediaMsg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return buffer;
    } catch { return null; }
}

// Recursively find ViewOnce media inside nested messages (Updated for Baileys 7.0.0)
function findViewOnceMedia(content) {
    if (!content) return null;

    // 1. Unwrap Standard Wrappers (including new Baileys 7.0.0 formats)
    if (content.viewOnceMessageV2) return findViewOnceMedia(content.viewOnceMessageV2.message);
    if (content.viewOnceMessage) return findViewOnceMedia(content.viewOnceMessage.message);
    if (content.viewOnceMessageV2Extension) return findViewOnceMedia(content.viewOnceMessageV2Extension.message);
    if (content.ephemeralMessage) return findViewOnceMedia(content.ephemeralMessage.message);
    if (content.documentWithCaptionMessage) return findViewOnceMedia(content.documentWithCaptionMessage.message);

    // New Baileys 7.0.0 / WhatsApp 2024 formats
    if (content.secretMediaMessage) return findViewOnceMedia(content.secretMediaMessage);
    if (content.secretMessageV2) return findViewOnceMedia(content.secretMessageV2.message);

    // 2. Check for ViewOnce Flags
    if (content.imageMessage?.viewOnce) return { msg: content.imageMessage, type: 'image' };
    if (content.videoMessage?.viewOnce) return { msg: content.videoMessage, type: 'video' };
    if (content.audioMessage?.viewOnce) return { msg: content.audioMessage, type: 'audio' };

    // 3. Check for media without explicit viewOnce flag (some wrappers strip it)
    if (content.imageMessage) return { msg: content.imageMessage, type: 'image' };
    if (content.videoMessage) return { msg: content.videoMessage, type: 'video' };
    if (content.audioMessage) return { msg: content.audioMessage, type: 'audio' };

    return null;
}

/* -------------------------------------------------------
   PLUGIN DEFINITION
------------------------------------------------------- */
export default {
    name: 'vv',
    alias: ['antiviewonce', 'antivo', 'reveal', 'readviewonce'],
    desc: 'Reveal ViewOnce messages',
    category: 'tools',
    permission: 'admin',

    // 1. COMMAND: Manual Reveal & Config
    command: {
        pattern: 'vv',

        run: async ({ sock, msg, args, isOwner }) => {
            const chat = msg.key.remoteJid;
            const sub = args[0]?.toLowerCase();

            // A. CONFIGURATION
            if (sub === 'auto') {
                if (!isOwner) {
                    return sock.sendMessage(chat, {
                        text: '❌ *Error*\n\nOnly the Bot Owner can toggle auto-recovery.'
                    }, { quoted: msg });
                }

                const enable = args[1] === 'on';
                updateConfig(chat, { auto: enable });
                return sock.sendMessage(chat, {
                    text: `✅ *Success*\n\nAuto-ViewOnce is now *${enable ? 'ENABLED' : 'DISABLED'}* for this chat.\n\nMedia will be sent to your DMs.`
                }, { quoted: msg });
            }

            // B. MANUAL REVEAL
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
                return sock.sendMessage(chat, {
                    text: '🔓 *VIEWONCE REVEAL*\n\nPlease reply to a ViewOnce message with *.vv*'
                }, { quoted: msg });
            }

            const target = findViewOnceMedia(quoted);
            if (!target) {
                return sock.sendMessage(chat, {
                    text: '❌ *Error*\n\nNo ViewOnce media found in quoted message.'
                }, { quoted: msg });
            }

            try {
                await sock.sendMessage(chat, { react: { text: '⏳', key: msg.key } });

                const buffer = await downloadMedia(target.msg, target.type);
                if (!buffer) throw new Error('Download failed');

                const caption = target.msg.caption || '🔓 *Revealed Media*';

                // Send back to chat (Manual command = User asked for it)
                if (target.type === 'image') await sock.sendMessage(chat, { image: buffer, caption }, { quoted: msg });
                else if (target.type === 'video') await sock.sendMessage(chat, { video: buffer, caption }, { quoted: msg });
                else if (target.type === 'audio') await sock.sendMessage(chat, { audio: buffer, ptt: true }, { quoted: msg });

                await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                return sock.sendMessage(chat, {
                    text: '❌ *Error*\n\nFailed to decrypt media. It might be expired.'
                }, { quoted: msg });
            }
        }
    },

    // 2. PASSIVE: Auto-Recover
    onMessage: async ({ sock, msg, chat }) => {
        const cfg = loadConfig();
        if (!cfg[chat]?.auto) return;

        // Check if current message is ViewOnce
        const target = findViewOnceMedia(msg.message);
        if (!target) return;

        try {
            const buffer = await downloadMedia(target.msg, target.type);
            if (!buffer) return;

            // Send to Bot Owner / Self (Saved Messages)
            // We do NOT send to group to respect privacy/spam
            const botJid = getBotJid(sock);
            const senderName = msg.pushName || 'User';
            const info = `🕵️‍♂️ *Auto-Recovered ViewOnce*\n\n👤 From: ${senderName}\n📍 Chat: ${chat.endsWith('@g.us') ? 'Group' : 'DM'}\n📝 Caption: ${target.msg.caption || 'None'}`;

            if (target.type === 'image') await sock.sendMessage(botJid, { image: buffer, caption: info });
            else if (target.type === 'video') await sock.sendMessage(botJid, { video: buffer, caption: info });
            else if (target.type === 'audio') await sock.sendMessage(botJid, { audio: buffer, ptt: false, caption: info });

            console.log(`[AntiVO] Recovered ${target.type} from ${senderName}`);

        } catch (e) {
            console.error('[AntiVO] Auto-recover failed:', e.message);
        }
    }
};
