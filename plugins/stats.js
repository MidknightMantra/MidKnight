import os from 'os';
import { getBotJid } from '../src/utils/jid.js';

export default {
  name: 'stats',
  alias: ['analytics', 'metrics'],
  command: {
    pattern: 'stats',
    desc: 'Show comprehensive Midknight bot statistics',
    category: 'core',
    react: '📊',

    run: async ({ sock, msg }) => {
      try {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: '📊', key: msg.key } });
      } catch { }

      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const h = Math.floor((uptime % 86400) / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);

      let uptimeStr = '';
      if (days > 0) uptimeStr += `${days}d `;
      if (h > 0) uptimeStr += `${h}h `;
      if (m > 0) uptimeStr += `${m}m `;
      uptimeStr += `${s}s`;

      const used = process.memoryUsage();
      const heapUsed = Math.round(used.heapUsed / 1024 / 1024);
      const heapTotal = Math.round(used.heapTotal / 1024 / 1024);
      const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
      const platform = os.platform();
      const arch = os.arch();
      const cpus = os.cpus().length;

      // Plugin count
      const pluginManager = global.MIDKNIGHT?.pluginManager;
      const pluginCount = pluginManager?.plugins?.size || 0;
      const commandCount = pluginManager?.commands?.size || 0;

      // Connection
      const botJid = getBotJid(sock);
      const phoneNumber = botJid?.split('@')[0] || 'Unknown';
      const isConnected = sock?.user?.id ? '🟢 Online' : '🔴 Offline';

      const message =
        `╭━━━『 📊 MIDKNIGHT ANALYTICS 』━━━╮
┃
┃ ⏱️ *Uptime:* ${uptimeStr}
┃ 🔌 *Status:* ${isConnected}
┃ 📱 *Number:* +${phoneNumber}
┃
┃ 💾 *Heap:* ${heapUsed}MB / ${heapTotal}MB
┃ 🖥️ *Total RAM:* ${totalRam}GB
┃ 🧮 *CPU Cores:* ${cpus}
┃
┃ 🔧 *Plugins:* ${pluginCount}
┃ ⚡ *Commands:* ${commandCount}
┃ 📦 *Node.js:* ${process.version}
┃ 🖥️ *Platform:* ${platform} (${arch})
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯

_Detailed system diagnostics powered by Midknight._`;

      await sock.sendMessage(msg.key.remoteJid, {
        text: message
      }, { quoted: msg });
    }
  }
};
