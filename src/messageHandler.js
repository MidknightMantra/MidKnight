/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Message Handler
   Routes incoming messages to appropriate plugins
   ═══════════════════════════════════════════════════════════════ */

import config from './config.js';
import pluginManager from './pluginManager.js';
import { log } from './utils/logger.js';
import { isGroup, isStatus, jidToPhone } from './utils/jid.js';
import { logRequestStart, logRequestEnd } from './monitoring/requestLogger.js';
import { handleError, PluginError, RateLimitError } from './monitoring/errorHandler.js';
import { checkRateLimit } from './middleware/rateLimit.js';

/**
 * Extract text content from any message type
 * @param {object} message - Baileys message object
 * @returns {string} Extracted text
 */
function extractText(message) {
    if (!message) return '';

    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.buttonsResponseMessage?.selectedButtonId ||
        message.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    );
}

/**
 * Parse command from text
 * @param {string} text - Message text
 * @param {string} prefix - Command prefix
 * @returns {object|null} { command, args, fullArgs }
 */
function parseCommand(text, prefix) {
    if (!text || !text.startsWith(prefix)) return null;

    const withoutPrefix = text.slice(prefix.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    const fullArgs = withoutPrefix.slice(command?.length || 0).trim();

    return { command, args, fullArgs };
}

/**
 * Check if sender is owner
 * @param {string} sender - Sender JID
 * @returns {boolean}
 */
function isOwner(sender) {
    const phone = jidToPhone(sender);
    return config.ownerNumber.some(num => phone?.includes(num.replace(/[^0-9]/g, '')));
}

/**
 * Main message handler
 * @param {object} sock - Baileys socket
 * @param {object} msg - Message object from messages.upsert
 */
export async function handleMessage(sock, msg) {
    try {
        // Skip if no message content
        if (!msg.message) return;

        const chat = msg.key.remoteJid;
        let sender = msg.key.participant || msg.key.remoteJid;

        // Fix sender for self-messages in DMs
        if (msg.key.fromMe && !msg.key.participant) {
            sender = sock.user?.id;
        }
        const isGroupChat = isGroup(chat);

        // Skip messages from self (unless we want to process them)
        if (msg.key.fromMe && !config.processSelfMessages) return;

        // Extract message text
        const text = extractText(msg.message);

        // Run passive message handlers (onMessage) asynchronously
        // We do NOT await this to prevent blocking command execution
        Promise.allSettled(pluginManager.messageHandlers.map(async (plugin) => {
            try {
                await plugin.onMessage({ sock, msg, text, chat, sender, isGroup: isGroupChat });
            } catch (e) {
                log.error(`onMessage error in ${plugin.name}`, { error: e.message });
            }
        }));

        // Parse command
        const parsed = parseCommand(text, config.prefix);
        if (!parsed || !parsed.command) return;

        const { command, args, fullArgs } = parsed;

        // Find matching plugin
        const plugin = pluginManager.getByCommand(command);
        if (!plugin) return;

        // Check if plugin is enabled
        if (plugin.enabled === false) return;

        // Mode checks
        if (config.mode === 'private' && !isOwner(sender)) return;

        // Owner-only plugin check
        if (plugin.ownerOnly && !isOwner(sender)) {
            return sock.sendMessage(chat, { text: '⚠️ *Owner Only*' }, { quoted: msg });
        }

        // Group-only plugin check
        if (plugin.groupOnly && !isGroupChat) {
            return sock.sendMessage(chat, { text: '⚠️ *Groups Only*' }, { quoted: msg });
        }

        // Rate limit check
        try {
            checkRateLimit(sender, isOwner(sender));
        } catch (error) {
            if (error instanceof RateLimitError) {
                log.warn('Rate limit exceeded', { sender: jidToPhone(sender), command });
                return sock.sendMessage(chat, {
                    text: `⏱️ *Rate Limit*\n${error.message}`
                }, { quoted: msg });
            }
            throw error;
        }

        // Auto-react if enabled
        if (config.autoReact && plugin.react) {
            const reactEmoji = typeof plugin.react === 'string' ? plugin.react :
                plugin.command?.react || '⚡';
            try {
                await sock.sendMessage(chat, { react: { text: reactEmoji, key: msg.key } });
            } catch { /* ignore react errors */ }
        }

        // Log request start
        const requestMetadata = logRequestStart({
            command,
            sender,
            chat,
            isGroup: isGroupChat,
            args
        });

        try {
            // Execute plugin command
            const runFn = plugin.run || plugin.command?.run;
            if (typeof runFn === 'function') {
                await runFn({
                    sock,
                    msg,
                    args,
                    text: fullArgs,
                    chat,
                    sender,
                    isGroup: isGroupChat,
                    isOwner: isOwner(sender),
                    config,
                    command
                });
            }

            // Log successful completion
            logRequestEnd(requestMetadata, true);

        } catch (pluginError) {
            // Log failed execution
            logRequestEnd(requestMetadata, false, pluginError);

            // Handle error
            handleError(
                new PluginError(plugin.name, pluginError.message, {
                    command,
                    sender: jidToPhone(sender),
                    chat: isGroupChat ? 'group' : 'dm'
                }),
                {
                    tags: {
                        plugin: plugin.name,
                        command,
                        chatType: isGroupChat ? 'group' : 'dm'
                    }
                }
            );

            // Notify user of error (optional, can be disabled)
            if (config.debug) {
                try {
                    await sock.sendMessage(chat, {
                        text: `❌ Error executing ${command}: ${pluginError.message}`
                    }, { quoted: msg });
                } catch { /* Ignore send errors */ }
            }
        }

    } catch (error) {
        handleError(error, {
            tags: { source: 'messageHandler' }
        });
    }
}

/**
 * Handle group participant updates (join/leave)
 * @param {object} sock - Baileys socket
 * @param {object} update - Group update object
 */
export async function handleGroupUpdate(sock, update) {
    try {
        for (const plugin of pluginManager.groupHandlers) {
            try {
                await plugin.onGroupUpdate({ sock, update });
            } catch (e) {
                log.error(`onGroupUpdate error in ${plugin.name}`, { error: e.message });
            }
        }
    } catch (error) {
        log.error('Group update handler error', { error: error.message });
    }
}

export default {
    handleMessage,
    handleGroupUpdate,
    extractText,
    parseCommand
};
