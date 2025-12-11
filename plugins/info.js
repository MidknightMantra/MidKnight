import os from 'os';
import fs from 'fs';
import path from 'path';
import deluxeUI from '../src/utils/deluxeUI.js';
import config from '../src/config.js';

export default {
  name: 'info',
  alias: ['about', 'botinfo', 'midknight'],

  command: {
    pattern: 'info',
    desc: 'Detailed bot information and statistics',
    category: 'core',
    react: 'ℹ️',

    run: async ({ sock, msg }) => {
      const chat = msg.key.remoteJid;

      try {
        await sock.sendMessage(chat, { react: { text: 'ℹ️', key: msg.key } });
      } catch { }

      // Calculate uptime
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      let uptimeStr = '';
      if (days > 0) uptimeStr += `${days}d `;
      if (hours > 0) uptimeStr += `${hours}h `;
      uptimeStr += `${minutes}m`;

      // Memory usage
      const used = process.memoryUsage();
      const heapUsed = Math.round(used.heapUsed / 1024 / 1024);
      const heapTotal = Math.round(used.heapTotal / 1024 / 1024);

      // System info
      const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
      const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);

      // Plugin count
      const pluginManager = global.MIDKNIGHT?.pluginManager;
      const pluginCount = pluginManager?.plugins?.size || 0;
      const commandCount = pluginManager?.commands?.size || 0;

      // Package info
      let version = '2.5.1';
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
        version = pkg.version || version;
      } catch { }

      const botData = {
        '🤖 *Name:*': config.botName || 'Midknight',
        '📌 *Version:*': `v${version}`,
        '⚡ *Prefix:*': config.prefix || '!',
        '👑 *Owner:*': config.ownerNumber?.split('@')[0] || 'MidknightMantra',
        '🔌 *Plugins:*': `${pluginCount} loaded`,
        '📝 *Commands:*': `${commandCount} registered`,
        '⏰ *Uptime:*': uptimeStr,
        '💾 *Memory:*': `${heapUsed}MB / ${heapTotal}MB`,
        '🖥️ *System:*': `${os.platform()} ${os.arch()}`,
        '⚙️ *Node.js:*': process.version,
        '🗄️ *RAM:*': `${freeMem}GB free / ${totalMem}GB total`
      };

      const infoMessage = deluxeUI.info('🤖', 'MIDKNIGHT BOT', botData);

      const footer = `

📖 *About:*
Midknight is a next-generation WhatsApp automation platform built with modern technologies and a focus on reliability.

🔗 *Links:*
• GitHub: github.com/MidknightMantra/Midknight
• Session: midknightmantra-pair.onrender.com

_"Efficiency is the essence of survival"_ ⚡`;

      // Try to send with image
      const imgPath = path.join(process.cwd(), 'assets', 'logo.jpg');

      if (fs.existsSync(imgPath)) {
        return sock.sendMessage(chat, {
          image: fs.readFileSync(imgPath),
          caption: infoMessage + footer,
          contextInfo: {
            externalAdReply: {
              title: 'Midknight Bot',
              body: `v${version} • ${pluginCount} Plugins`,
              sourceUrl: 'https://github.com/MidknightMantra/Midknight',
              mediaType: 1,
              renderLargerThumbnail: true,
              thumbnailUrl: 'https://i.imgur.com/3LgHj2N.jpeg'
            }
          }
        }, { quoted: msg });
      }

      // Text only fallback
      return sock.sendMessage(chat, {
        text: infoMessage + footer,
        contextInfo: {
          externalAdReply: {
            title: 'Midknight Bot',
            body: `v${version} • ${pluginCount} Plugins`,
            sourceUrl: 'https://github.com/MidknightMantra/Midknight',
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnailUrl: 'https://i.imgur.com/3LgHj2N.jpeg'
          }
        }
      }, { quoted: msg });
    }
  }
};
