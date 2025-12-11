import fs from 'fs';
import path from 'path';

/* ═══════════════════════════════════════════════════════════════
   DATABASE HANDLER (Per-Group Config)
   ═══════════════════════════════════════════════════════════════ */
const CONFIG_FILE = path.join(process.cwd(), 'data', 'antibadword.json');

if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
}

function getGroupConfig(jid) {
    try {
        if (!fs.existsSync(CONFIG_FILE)) return { enabled: false, action: 'warn', words: [] };
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        return data[jid] || { enabled: false, action: 'warn', words: [] };
    } catch {
        return { enabled: false, action: 'warn', words: [] };
    }
}

function updateGroupConfig(jid, update) {
    try {
        const data = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
        const current = data[jid] || { enabled: false, action: 'warn', words: [] };
        data[jid] = { ...current, ...update };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
        return data[jid];
    } catch (e) {
        console.error('AntiBadWord Save Error:', e);
    }
}

/* ═══════════════════════════════════════════════════════════════
   PLUGIN DEFINITION
   ═══════════════════════════════════════════════════════════════ */

export default {
    name: 'antibadword',
    alias: ['badword', 'toxic', 'filter'],
    category: 'protection',
    permission: 'admin',
    desc: 'Configure banned words for the group',

    command: {
        pattern: 'antibadword',
        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            if (!chat.endsWith('@g.us')) {
                return sock.sendMessage(chat, { text: '❌ This command is for groups only.' }, { quoted: msg });
            }

            const cfg = getGroupConfig(chat);
            const subCmd = args[0]?.toLowerCase();
            const value = args.slice(1).join(' ').toLowerCase();

            // HELP MENU
            if (!subCmd) {
                const text = `🤬 *TOXIC FILTER*\n\n` +
                    `• Status: ${cfg.enabled ? '✅ ON' : '🔴 OFF'}\n` +
                    `• Action: ${cfg.action.toUpperCase()}\n` +
                    `• Banned Words: ${cfg.words.length}\n\n` +
                    `*Usage:*\n` +
                    `• .badword on/off\n` +
                    `• .badword add <word>\n` +
                    `• .badword del <word>\n` +
                    `• .badword list\n` +
                    `• .badword action kick/warn/delete`;
                return sock.sendMessage(chat, { text }, { quoted: msg });
            }

            switch (subCmd) {
                case 'on':
                case 'enable':
                    updateGroupConfig(chat, { enabled: true });
                    return sock.sendMessage(chat, { text: '✅ Toxic filter is now *ACTIVE*!' }, { quoted: msg });

                case 'off':
                case 'disable':
                    updateGroupConfig(chat, { enabled: false });
                    return sock.sendMessage(chat, { text: '✅ Toxic filter is now *DISABLED*.' }, { quoted: msg });

                case 'add':
                    if (!value) return sock.sendMessage(chat, { text: '❌ Please specify a word to ban.' }, { quoted: msg });
                    if (cfg.words.includes(value)) return sock.sendMessage(chat, { text: '⚠️ That word is already banned.' }, { quoted: msg });

                    updateGroupConfig(chat, { words: [...cfg.words, value] });
                    return sock.sendMessage(chat, { text: `✅ Added *"${value}"* to banned list.` }, { quoted: msg });

                case 'del':
                case 'remove':
                    if (!value) return sock.sendMessage(chat, { text: '❌ Please specify a word to remove.' }, { quoted: msg });
                    if (!cfg.words.includes(value)) return sock.sendMessage(chat, { text: '⚠️ That word is not in the list.' }, { quoted: msg });

                    updateGroupConfig(chat, { words: cfg.words.filter(w => w !== value) });
                    return sock.sendMessage(chat, { text: `✅ Removed *"${value}"* from list.` }, { quoted: msg });

                case 'list':
                    if (cfg.words.length === 0) {
                        return sock.sendMessage(chat, { text: '📝 *BANNED WORDS*\n\nNo words banned yet.' }, { quoted: msg });
                    }
                    const wordList = `📝 *BANNED WORDS* (${cfg.words.length})\n\n` + cfg.words.map((w, i) => `${i + 1}. ${w}`).join('\n');
                    return sock.sendMessage(chat, { text: wordList }, { quoted: msg });

                case 'action':
                    if (!['warn', 'delete', 'kick'].includes(value)) {
                        return sock.sendMessage(chat, { text: '❌ Invalid action. Try: warn, delete, or kick' }, { quoted: msg });
                    }
                    updateGroupConfig(chat, { action: value });
                    return sock.sendMessage(chat, { text: `✅ Action set to: *${value.toUpperCase()}*` }, { quoted: msg });

                default:
                    return sock.sendMessage(chat, { text: '❌ Unknown option. Use `.badword` for help.' }, { quoted: msg });
            }
        }
    },

    // Passive message monitoring
    onMessage: async ({ sock, msg }) => {
        const chat = msg.key.remoteJid;
        if (!chat.endsWith('@g.us')) return;

        const cfg = getGroupConfig(chat);
        if (!cfg.enabled || cfg.words.length === 0) return;

        const text = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            ''
        ).toLowerCase();

        if (!text) return;

        // Check for toxic words
        const isToxic = cfg.words.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(text);
        });

        if (!isToxic) return;

        const sender = msg.key.participant;

        try {
            // Check if sender is admin (admins are immune)
            const groupMetadata = await sock.groupMetadata(chat);
            const participant = groupMetadata.participants.find(p => p.id === sender);
            if (participant?.admin) return;

            // Check if bot is admin
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const bot = groupMetadata.participants.find(p => p.id === botId);
            if (!bot?.admin) return;

            // Execute action
            if (cfg.action === 'delete' || cfg.action === 'kick') {
                await sock.sendMessage(chat, { delete: msg.key });
            }

            if (cfg.action === 'kick') {
                await sock.groupParticipantsUpdate(chat, [sender], 'remove');
                await sock.sendMessage(chat, {
                    text: `🚫 *Removed for toxic language*`,
                    mentions: [sender]
                });
            } else if (cfg.action === 'warn') {
                await sock.sendMessage(chat, {
                    text: `⚠️ @${sender.split('@')[0]}, watch your language!`,
                    mentions: [sender]
                });
            }
        } catch (e) {
            console.error('AntiBadWord Action Failed:', e);
        }
    }
};
