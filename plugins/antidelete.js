import fs from 'fs';
import path from 'path';

/* -------------------------------------------------------
   CONFIG & CACHE
------------------------------------------------------- */
const CONFIG_DIR = path.join(process.cwd(), 'data/session/config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'antidelete.json');
const MESSAGE_CACHE = new Map(); // In-memory message store

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

let _configCache = null;

function readCfg() {
  if (_configCache) return _configCache;
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      _configCache = { enabled: true, ignore: [] };
    } else {
      _configCache = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    _configCache = { enabled: true, ignore: [] };
  }
  return _configCache;
}

function saveCfg(cfg) {
  _configCache = cfg;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

/* -------------------------------------------------------
   PLUGIN DEFINITION
------------------------------------------------------- */
export default {
  name: 'antidelete',
  alias: ['ad', 'antidel'],
  desc: 'Recover deleted messages',
  category: 'protection',
  permission: 'owner',

  command: {
    pattern: 'antidelete',
    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const cfg = readCfg();
      const mode = args[0]?.toLowerCase();

      if (!mode) {
        const text = `🛡️ *ANTI-DELETE*\n\n` +
          `• Status: ${cfg.enabled ? '✅ Active' : '🔴 Disabled'}\n` +
          `• Ignored Chats: ${cfg.ignore?.length || 0}\n` +
          `• Cache Size: ${MESSAGE_CACHE.size} messages\n\n` +
          `*Usage:*\n` +
          `• .antidelete on/off\n` +
          `• .antidelete ignore @user\n` +
          `• .antidelete unignore @user\n` +
          `• .antidelete list\n` +
          `• .antidelete clear`;
        return sock.sendMessage(chat, { text }, { quoted: msg });
      }

      if (mode === 'on') {
        cfg.enabled = true;
        saveCfg(cfg);
        return sock.sendMessage(chat, { text: '✅ Anti-Delete is now *ACTIVE* globally.' }, { quoted: msg });
      }

      if (mode === 'off') {
        cfg.enabled = false;
        saveCfg(cfg);
        return sock.sendMessage(chat, { text: '✅ Anti-Delete is now *DISABLED*.' }, { quoted: msg });
      }

      if (mode === 'ignore') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        const target = quoted?.participant || quoted?.mentionedJid?.[0] || chat;

        if (!cfg.ignore) cfg.ignore = [];
        if (cfg.ignore.includes(target)) {
          return sock.sendMessage(chat, { text: '⚠️ Already ignored.' }, { quoted: msg });
        }

        cfg.ignore.push(target);
        saveCfg(cfg);
        return sock.sendMessage(chat, {
          text: `✅ Messages from this chat will NO LONGER be recovered.`
        }, { quoted: msg });
      }

      if (mode === 'unignore') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        const target = quoted?.participant || quoted?.mentionedJid?.[0] || chat;

        if (!cfg.ignore) cfg.ignore = [];
        if (!cfg.ignore.includes(target)) {
          return sock.sendMessage(chat, { text: '⚠️ Not in ignore list.' }, { quoted: msg });
        }

        cfg.ignore = cfg.ignore.filter(x => x !== target);
        saveCfg(cfg);
        return sock.sendMessage(chat, {
          text: `✅ Messages will now be recovered from this chat.`
        }, { quoted: msg });
      }

      if (mode === 'list') {
        if (!cfg.ignore || cfg.ignore.length === 0) {
          return sock.sendMessage(chat, { text: '📝 *IGNORED CHATS*\n\nNo chats ignored.' }, { quoted: msg });
        }
        const list = `📝 *IGNORED CHATS* (${cfg.ignore.length})\n\n` +
          cfg.ignore.map((jid, i) => `${i + 1}. ${jid.split('@')[0]}`).join('\n');
        return sock.sendMessage(chat, { text: list }, { quoted: msg });
      }

      if (mode === 'clear') {
        MESSAGE_CACHE.clear();
        return sock.sendMessage(chat, { text: '✅ Message cache cleared.' }, { quoted: msg });
      }

      return sock.sendMessage(chat, { text: '❌ Unknown option. Use `.antidelete` for help.' }, { quoted: msg });
    }
  },

  // Store messages
  onMessage: async ({ sock, msg }) => {
    const cfg = readCfg();
    if (!cfg.enabled) return;

    const chat = msg.key.remoteJid;
    if (cfg.ignore?.includes(chat)) return;

    // Cache message with key
    const key = `${chat}_${msg.key.id}`;
    MESSAGE_CACHE.set(key, {
      msg,
      chat,
      timestamp: Date.now()
    });

    // Auto-cleanup old messages (keep last 1000)
    if (MESSAGE_CACHE.size > 1000) {
      const firstKey = MESSAGE_CACHE.keys().next().value;
      MESSAGE_CACHE.delete(firstKey);
    }
  },

  // Handle delete events
  onMessageDelete: async ({ sock, events }) => {
    const cfg = readCfg();
    if (!cfg.enabled) return;

    for (const event of events) {
      const chat = event.key.remoteJid;
      if (cfg.ignore?.includes(chat)) continue;

      const key = `${chat}_${event.key.id}`;
      const cached = MESSAGE_CACHE.get(key);

      if (!cached) continue;

      try {
        const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const deletedMsg = cached.msg;

        const text = deletedMsg.message?.conversation ||
          deletedMsg.message?.extendedTextMessage?.text ||
          '[Media/Sticker]';

        const sender = deletedMsg.key.participant || deletedMsg.key.remoteJid;
        const senderName = deletedMsg.pushName || sender.split('@')[0];

        await sock.sendMessage(ownerJid, {
          text: `🗑️ *DELETED MESSAGE RECOVERED*\n\n` +
            `👤 From: ${senderName}\n` +
            `📍 Chat: ${chat.endsWith('@g.us') ? 'Group' : 'DM'}\n` +
            `📝 Message: ${text}`
        });

        // Forward actual message if available
        if (deletedMsg.message) {
          await sock.sendMessage(ownerJid, { forward: deletedMsg });
        }

      } catch (e) {
        console.error('[AntiDelete] Recovery failed:', e.message);
      }
    }
  }
};
