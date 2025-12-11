import db from '../src/database.js';

// Load Collection
const autoStatusDB = db.collection('autostatus');

// Defaults
const DEFAULT = {
  enabled: true,
  react: true,
  emoji: '💚',
  throttleMs: 30000,
  viewDelayMin: 2000,
  viewDelayMax: 5000
};

// Helper: Get Config (with defaults)
function getConfig(key = 'global') {
  const data = autoStatusDB.get(key);
  return { ...DEFAULT, ...(data || {}) };
}

// Helper: Save Config
function saveConfig(key, data) {
  autoStatusDB.set(key, data);
}

const lastReact = new Map();
const delay = (ms) => new Promise(res => setTimeout(res, ms));

export default {
  name: 'autostatus',
  alias: ['autosview', 'statusview'],
  desc: 'Automatically view and react to WhatsApp Statuses',
  category: 'settings',
  permission: 'owner',

  command: {
    pattern: 'autostatus',
    run: async ({ sock, msg, args }) => {
      console.log('AUTOSTATUS COMMAND TRIGGERED');
      console.log('ARGS:', args);
      const chat = msg.key.remoteJid;
      const cfg = getConfig('global');
      console.log('CONFIG:', cfg);
      const sub = args[0]?.toLowerCase();
      console.log('SUBCOMMAND:', sub);

      if (!sub) {
        const text = `👁️ *AUTO STATUS*\n\n• View: ${cfg.enabled ? '✅ ON' : '🔴 OFF'}\n• React: ${cfg.react ? '✅ ON' : '🔴 OFF'}\n• Emoji: ${cfg.emoji}\n\nUsage:\n• .autostatus on/off\n• .autostatus react on/off\n• .autostatus emoji 🔥`;
        return sock.sendMessage(chat, { text }, { quoted: msg });
      }

      if (sub === 'on') {
        cfg.enabled = true; saveConfig('global', cfg);
        return sock.sendMessage(chat, { text: '✅ Auto-Status Viewing ENABLED.' }, { quoted: msg });
      }
      if (sub === 'off') {
        cfg.enabled = false; saveConfig('global', cfg);
        return sock.sendMessage(chat, { text: '✅ Auto-Status Viewing DISABLED.' }, { quoted: msg });
      }

      if (sub === 'react') {
        const mode = args[1]?.toLowerCase();
        if (mode === 'on') { cfg.react = true; saveConfig('global', cfg); return sock.sendMessage(chat, { text: '✅ Status Reactions ENABLED.' }, { quoted: msg }); }
        if (mode === 'off') { cfg.react = false; saveConfig('global', cfg); return sock.sendMessage(chat, { text: '✅ Status Reactions DISABLED.' }, { quoted: msg }); }
        return sock.sendMessage(chat, { text: '❌ Usage: .autostatus react on/off' }, { quoted: msg });
      }

      if (sub === 'emoji') {
        const emo = args[1];
        if (!emo) return sock.sendMessage(chat, { text: '❌ Please provide an emoji.' }, { quoted: msg });
        cfg.emoji = emo;
        saveConfig('global', cfg);
        return sock.sendMessage(chat, { text: `✅ Reaction emoji set to: ${emo}` }, { quoted: msg });
      }
    }
  },

  onStatus: async ({ sock, msg, key }) => {
    try {
      const cfg = getConfig('global');

      if (!cfg.enabled) return;

      if (key.fromMe) return;

      const participant = key.participant || key.remoteJid;

      const viewTime = Math.floor(Math.random() * (cfg.viewDelayMax - cfg.viewDelayMin) + cfg.viewDelayMin);
      await delay(viewTime);

      try {
        await sock.readMessages([key]);
        // log.debug(`[AutoStatus] ✅ Viewed status from ${participant.split('@')[0]}`);
      } catch (e) {
        console.error(`[AutoStatus] ❌ View failed: ${e.message}`);
      }

      if (cfg.react) {
        const now = Date.now();
        const last = lastReact.get(participant) || 0;
        if (now - last < cfg.throttleMs) return;

        await delay(1000);

        try {
          await sock.sendMessage('status@broadcast', {
            react: { text: cfg.emoji, key: key }
          }, { statusJidList: [participant] });
          lastReact.set(participant, now);
          console.log(`[AutoStatus] ✅ Viewed & Reacted to ${participant.split('@')[0]} with ${cfg.emoji}`);
        } catch (e) {
          console.error(`[AutoStatus] ❌ React failed: ${e.message}`);
        }
      }
    } catch (e) {
      console.error(`[AutoStatus] Error in onStatus handler:`, e);
    }
  }
};
