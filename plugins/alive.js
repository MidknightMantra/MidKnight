import fs from 'fs';
import path from 'path';
import os from 'os';
import config from '../src/config.js';

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '☀️ Good Morning';
  if (hour < 18) return '🌤️ Good Afternoon';
  return '🌙 Good Evening';
}

function getSystemStatus() {
  const totalMem = os.totalmem() / 1024 / 1024 / 1024; // GB
  const freeMem = os.freemem() / 1024 / 1024 / 1024;
  const usedMem = totalMem - freeMem;
  const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

  const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  const cpuCount = os.cpus().length;

  return {
    memPercent,
    heapUsed,
    cpuCount,
    platform: os.platform(),
    arch: os.arch()
  };
}

export default {
  name: 'alive',
  command: {
    pattern: 'alive',
    desc: 'Check if Midknight is online with detailed stats',
    react: '⚡',
    category: 'core',

    run: async ({ sock, msg }) => {
      const chat = msg.key.remoteJid;
      const startTime = Date.now();

      // Send initial "checking" message
      const tempMsg = await sock.sendMessage(chat, {
        text: '⏳ *Checking system status...*'
      }, { quoted: msg });

      // Gather stats
      const uptime = formatUptime(process.uptime());
      const sys = getSystemStatus();
      const greeting = getGreeting();
      const responseTime = Date.now() - startTime;

      // Get plugin count
      const pluginManager = global.MIDKNIGHT?.pluginManager;
      const pluginCount = pluginManager?.commands?.size || 0;

      // Performance emoji
      let perfEmoji = '🟢';
      if (responseTime > 500) perfEmoji = '🟡';
      if (responseTime > 1000) perfEmoji = '🔴';

      const text = `╭━━━『 ⚡ MIDKNIGHT SYSTEMS 』━━━╮

${greeting}

🤖 *STATUS*
• Bot: ${config.botName}
• Status: ${perfEmoji} Online & Active
• Response: ${responseTime}ms
• Uptime: ${uptime}

📊 *SYSTEM METRICS*
• RAM Usage: ${sys.heapUsed} MB
• Memory Load: ${sys.memPercent}%
• CPU Cores: ${sys.cpuCount}
• Platform: ${sys.platform} (${sys.arch})

🔧 *CAPABILITIES*
• Plugins: ${pluginCount} loaded
• Commands: Ready
• AI: Multi-model racing
• Downloads: 20 API sources

👑 *OWNER*
• ${config.ownerNumber || 'Jabez Motari'}

╰━━━━━━━━━━━━━━━━━━━━━━━╯

⚡ _"Efficiency is the essence of survival."_

➤ Type *.menu* to see all commands`;

      // PATHS
      const imgPath = path.join(process.cwd(), 'assets', 'logo.jpg');

      // Enhanced Context Info with Social Links
      const contextInfo = {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363185381936584@newsletter',
          newsletterName: 'Midknight Systems',
          serverMessageId: -1
        },
        externalAdReply: {
          title: '⚡ Midknight Bot',
          body: `${pluginCount} plugins • ${sys.cpuCount} cores • ${responseTime}ms ping`,
          thumbnailUrl: 'https://i.imgur.com/midknight.jpg',
          sourceUrl: 'https://github.com/MidknightMantra',
          mediaType: 1,
          renderLargerThumbnail: true
        }
      };

      // Update with full response
      try {
        if (fs.existsSync(imgPath)) {
          await sock.sendMessage(chat, {
            image: fs.readFileSync(imgPath),
            caption: text,
            contextInfo
          }, { edit: tempMsg.key });
        } else {
          await sock.sendMessage(chat, {
            text,
            contextInfo
          }, { edit: tempMsg.key });
        }
      } catch {
        // Edit failed, send new message
        if (fs.existsSync(imgPath)) {
          return await sock.sendMessage(chat, {
            image: fs.readFileSync(imgPath),
            caption: text,
            contextInfo
          }, { quoted: msg });
        }
        return sock.sendMessage(chat, { text, contextInfo }, { quoted: msg });
      }
    }
  }
};