import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------------------------------
   CONFIG & PERSISTENCE
------------------------------------------------------- */
const CONFIG_DIR = path.join(process.cwd(), 'data/session/config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'autobio.json');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: false }, null, 2));
}

function readCfg() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return { enabled: false }; }
}

function saveCfg(c) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
}

/* -------------------------------------------------------
   PHRASE BANK
------------------------------------------------------- */
const phrases = [
  'Midknight Systems Online',
  'Silence is an answer',
  'Memento Mori',
  'Amor Fati',
  'Tempus Fugit',
  'Sic Parvis Magna',
  'Veni, Vidi, Vici',
  'Trust no one completely',
  'Patience is a weapon',
  'Observe the unseen',
  '404: Reality Not Found',
  'Loading consciousness...',
  'Running on caffeine',
  'Error: Human undefined',
  'I see you looking',
  'The void stares back',
  'Shadows do not bleed',
  'Chaos is a ladder'
];

/* -------------------------------------------------------
   PLUGIN LOGIC
------------------------------------------------------- */
let bioInterval = null;

function startBioLoop(sock) {
  if (bioInterval) clearInterval(bioInterval);

  bioInterval = setInterval(async () => {
    try {
      const cfg = readCfg();
      if (!cfg.enabled) {
        clearInterval(bioInterval);
        bioInterval = null;
        return;
      }

      // 1. Get Dynamic Data
      const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
      const uptime = process.uptime();
      const uptimeStr = formatUptime(uptime);
      const speed = (Math.random() * (0.5 - 0.1) + 0.1).toFixed(4); // Fake latency for "tech" feel

      // 2. Pick Random Phrase
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];

      // 3. Construct Bio (Rotate formats)
      const formats = [
        `${phrase} | ⌚ ${time}`,
        `Midknight Bot | 🚀 ${uptimeStr} | ⚡ ${speed}s`,
        `📅 ${new Date().toLocaleDateString()} | ${phrase}`,
        `🔋 System Active | ⌚ ${time} | ${phrase}`,
        `⚡ Speed: ${speed}s | ⌚ ${time}`
      ];

      const statusText = formats[Math.floor(Math.random() * formats.length)];

      // 4. Update
      await sock.updateProfileStatus(statusText);

    } catch (e) {
      console.error('[AutoBio] Update failed:', e.message);
    }
  }, 60000); // Update every minute
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default {
  name: 'autobio',
  alias: ['setbio', 'bio'],

  // Auto-start on boot if enabled
  init: async ({ sock }) => {
    const cfg = readCfg();
    if (cfg.enabled) {
      console.log('[AutoBio] Starting auto-bio loop...');
      startBioLoop(sock);
    }
  },

  command: {
    pattern: 'autobio',
    desc: 'Toggle dynamic profile status',
    category: 'settings',
    react: '🎭',

    run: async ({ sock, msg, args }) => {
      if (!msg.key.fromMe) return;

      const mode = args[0]?.toLowerCase();
      const cfg = readCfg();

      if (!mode) {
        return sock.sendMessage(msg.key.remoteJid, {
          text: `╭━━━『 🎭 AUTO-BIO 』━━━╮
┃ 
┃ 🔄 *Status:* ${cfg.enabled ? '🟢 Active' : '🔴 Inactive'}
┃ ⏱️ *Interval:* 60s
┃ 📝 *Phrases:* ${phrases.length}
┃ 
╰━━━━━━━━━━━━━━━━━━━━━╯

*Commands:*
• \`.autobio on\` - Enable
• \`.autobio off\` - Disable`
        }, { quoted: msg });
      }

      if (mode === 'on') {
        if (cfg.enabled && bioInterval) {
          return sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Auto-Bio is already running.' }, { quoted: msg });
        }

        cfg.enabled = true;
        saveCfg(cfg);
        startBioLoop(sock);

        return sock.sendMessage(msg.key.remoteJid, {
          text: '✅ *Auto-Bio Enabled*\n\nProfile status will update every minute.'
        }, { quoted: msg });
      }

      if (mode === 'off') {
        if (!cfg.enabled) {
          return sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Auto-Bio is already disabled.' }, { quoted: msg });
        }

        cfg.enabled = false;
        saveCfg(cfg);
        if (bioInterval) clearInterval(bioInterval);
        bioInterval = null;

        // Reset to default
        await sock.updateProfileStatus('🤖 Midknight Systems | Online');

        return sock.sendMessage(msg.key.remoteJid, {
          text: '🔴 *Auto-Bio Disabled*\n\nProfile status reset to default.'
        }, { quoted: msg });
      }
    }
  }
};