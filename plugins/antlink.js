import fs from 'fs';
import path from 'path';
import { getBotJid } from '../src/utils/jid.js';

/* -------------------------------------------------------
   CONFIG HANDLER
------------------------------------------------------- */
const CONFIG_DIR = path.join(process.cwd(), 'data/session/config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'antlink.json');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

// In-memory cache
let _groupConfigCache = null;

function loadConfig() {
  if (_groupConfigCache) return _groupConfigCache;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      _groupConfigCache = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } else {
      _groupConfigCache = {};
    }
  } catch {
    _groupConfigCache = {};
  }
  return _groupConfigCache;
}

function getGroupConfig(jid) {
  const db = loadConfig();
  return db[jid] || { enabled: false, action: 'warn' };
}

function updateGroupConfig(jid, update) {
  try {
    const db = loadConfig();
    const current = db[jid] || { enabled: false, action: 'warn' };
    db[jid] = { ...current, ...update };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(db, null, 2));
    _groupConfigCache = db;
    return db[jid];
  } catch (e) {
    console.error('Antlink save error:', e);
  }
}

/* -------------------------------------------------------
   HELPER: Link Detection
------------------------------------------------------- */
function containsLink(text = '') {
  const regex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(wa\.me\/[^\s]+)|(t\.me\/[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)/i;
  return regex.test(text);
}

/* -------------------------------------------------------
   PLUGIN DEFINITION
------------------------------------------------------- */
export default {
  name: 'antlink',
  alias: ['antilink', 'link'],
  desc: 'Block links in groups',
  category: 'protection',
  permission: 'admin',

  command: {
    pattern: 'antlink',
    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      if (!chat.endsWith('@g.us')) {
        return sock.sendMessage(chat, { text: '❌ This command is for groups only.' }, { quoted: msg });
      }

      const cfg = getGroupConfig(chat);
      const cmd = (args[0] || '').toLowerCase();
      const val = (args[1] || '').toLowerCase();

      // Help Menu
      if (!cmd) {
        const text = `🛡️ *ANTILINK PROTECTION*\n\n` +
          `• Status: ${cfg.enabled ? '✅ Active' : '🔴 Disabled'}\n` +
          `• Action: ${cfg.action.toUpperCase()}\n\n` +
          `*Usage:*\n` +
          `• .antlink on/off\n` +
          `• .antlink action warn\n` +
          `• .antlink action delete\n` +
          `• .antlink action kick`;
        return sock.sendMessage(chat, { text }, { quoted: msg });
      }

      // Toggles
      if (cmd === 'on') {
        updateGroupConfig(chat, { enabled: true });
        return sock.sendMessage(chat, { text: '✅ Antilink is now *ACTIVE* in this group.' }, { quoted: msg });
      }

      if (cmd === 'off') {
        updateGroupConfig(chat, { enabled: false });
        return sock.sendMessage(chat, { text: '✅ Antilink is now *DISABLED*.' }, { quoted: msg });
      }

      // Actions
      if (cmd === 'action') {
        if (['warn', 'delete', 'kick'].includes(val)) {
          updateGroupConfig(chat, { action: val });
          return sock.sendMessage(chat, { text: `✅ Action set to: *${val.toUpperCase()}*` }, { quoted: msg });
        }
        return sock.sendMessage(chat, { text: '❌ Invalid action. Use: warn, delete, or kick' }, { quoted: msg });
      }

      return sock.sendMessage(chat, { text: '❌ Unknown option. Use `.antlink` for help.' }, { quoted: msg });
    }
  },

  // Monitor Messages for Links
  onMessage: async ({ sock, msg }) => {
    const chat = msg.key.remoteJid;
    if (!chat.endsWith('@g.us')) return;

    const cfg = getGroupConfig(chat);
    if (!cfg.enabled) return;

    // Get Text
    const text = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      '';

    if (!text || !containsLink(text)) return;

    const sender = msg.key.participant;
    const botId = getBotJid(sock);

    try {
      // Check if sender is admin
      const groupMetadata = await sock.groupMetadata(chat);
      const participant = groupMetadata.participants.find(p => p.id === sender);
      if (participant?.admin) return; // Admins can send links

      // Check if bot is admin
      const bot = groupMetadata.participants.find(p => p.id === botId);
      if (!bot?.admin) return; // Can't delete/kick if not admin

      // Execute action
      if (cfg.action === 'delete' || cfg.action === 'kick') {
        await sock.sendMessage(chat, { delete: msg.key });
      }

      if (cfg.action === 'kick') {
        await sock.groupParticipantsUpdate(chat, [sender], 'remove');
        await sock.sendMessage(chat, {
          text: `🚫 *Link Detected - User Removed*`,
          mentions: [sender]
        });
      } else if (cfg.action === 'warn') {
        await sock.sendMessage(chat, {
          text: `⚠️ @${sender.split('@')[0]}, links are not allowed!`,
          mentions: [sender]
        });
      }
    } catch (e) {
      console.error('Antlink action failed:', e);
    }
  }
};
