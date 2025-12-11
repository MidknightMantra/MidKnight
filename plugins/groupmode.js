import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------------------------------
   CONFIG HANDLER
------------------------------------------------------- */
const CONFIG_DIR = path.join(__dirname, '../config');
const FILE = path.join(CONFIG_DIR, 'groupmode.json');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ global: true, groups: {} }, null, 2));
}

function load() {
  try { return JSON.parse(fs.readFileSync(FILE)); }
  catch { return { global: true, groups: {} }; }
}

function save(cfg) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
}

/* -------------------------------------------------------
   HELPER: Check if bot should work in a group
   Usage: import { isGroupAllowed } from './plugins/groupmode.js';
   if (!isGroupAllowed(chatId)) return; 
------------------------------------------------------- */
export function isGroupAllowed(jid) {
  const cfg = load();
  // Specific group setting overrides global setting
  if (cfg.groups[jid] !== undefined) {
    return cfg.groups[jid];
  }
  return cfg.global;
}

/* -------------------------------------------------------
   PLUGIN
------------------------------------------------------- */
export default {
  name: 'groupmode',

  command: {
    pattern: 'groupmode',
    desc: 'Manage bot availability in groups',
    category: 'settings',
    react: '⚙️',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      // 1. Permission Check
      if (!msg.key.fromMe) {
        return sock.sendMessage(chat, { text: '❌ Only the bot owner can change mode settings.' });
      }

      const cfg = load();
      const cmd = (args[0] || '').toLowerCase();

      // 2. Commands
      if (cmd === 'on') {
        cfg.global = true;
        save(cfg);
        return sock.sendMessage(chat, { text: '🌍 *Global Group Mode: ON*\nThe bot will now respond in all groups by default.' });
      }

      if (cmd === 'off') {
        cfg.global = false;
        save(cfg);
        return sock.sendMessage(chat, { text: '🌍 *Global Group Mode: OFF*\nThe bot is now silent in groups (except those specifically unlocked).' });
      }

      if (cmd === 'lock' || cmd === 'disable') {
        cfg.groups[chat] = false;
        save(cfg);
        return sock.sendMessage(chat, { text: '🔒 *Locked*\nMidknight has been disabled for *this specific group*.' });
      }

      if (cmd === 'unlock' || cmd === 'enable') {
        cfg.groups[chat] = true;
        save(cfg);
        return sock.sendMessage(chat, { text: '🔓 *Unlocked*\nMidknight has been enabled for *this specific group*.' });
      }

      if (cmd === 'reset') {
        delete cfg.groups[chat];
        save(cfg);
        return sock.sendMessage(chat, { text: '🔄 Group setting reset to Global Default.' });
      }

      // 3. Status Display
      // Determine effective status
      const specific = cfg.groups[chat];
      const effective = specific !== undefined ? specific : cfg.global;
      const statusEmoji = effective ? '🟢' : '🔴';

      return sock.sendMessage(chat, {
        text:
          `⚙️ *Midknight Group Configuration*

🌍 *Global Setting:* ${cfg.global ? 'ON' : 'OFF'}
👥 *This Group:* ${specific === undefined ? 'Default' : (specific ? 'Unlocked 🔓' : 'Locked 🔒')}
──────────────
${statusEmoji} *Effective Status:* ${effective ? 'ACTIVE' : 'SILENT'}

*Commands:*
• .groupmode on/off (Global)
• .groupmode lock/unlock (This Group)
• .groupmode reset`
      });
    }
  }
};