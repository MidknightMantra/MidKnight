import os from 'os';
import process from 'process';

/* -------------------------------------------------------
   HELPER: Format Uptime (Seconds -> H M S)
------------------------------------------------------- */
function formatUptime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const dDisplay = d > 0 ? d + (d == 1 ? ' day, ' : ' days, ') : '';
  const hDisplay = h > 0 ? h + (h == 1 ? ' hour, ' : ' hours, ') : '';
  const mDisplay = m > 0 ? m + (m == 1 ? ' min, ' : ' mins, ') : '';
  const sDisplay = s > 0 ? s + (s == 1 ? ' sec' : ' secs') : '';
  return dDisplay + hDisplay + mDisplay + sDisplay;
}

export default {
  name: 'ping',
  alias: ['p', 'status'],

  command: {
    pattern: 'ping',
    desc: 'Check Midknight\'s latency and system health',
    category: 'tools',
    react: '🜁',

    run: async ({ sock, msg }) => {
      const chat = msg.key.remoteJid;

      try {
        const start = Date.now();

        // 1. Send the "Measuring" placeholder
        // We save this message object to 'keyMsg' so we can edit it later
        const keyMsg = await sock.sendMessage(chat, {
          text: '🌑 *Measuring the pulse of the void...*',
        }, { quoted: msg });

        // 2. Calculate Latency
        const end = Date.now();
        const latency = end - start;

        // 3. Calculate System Stats
        const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2); // MB
        const totalRam = (os.totalmem() / 1024 / 1024).toFixed(2); // MB (System Total)
        const hostname = os.hostname();
        const uptime = formatUptime(process.uptime());

        // 4. Determine "Void Status" based on speed
        const status =
          latency <= 200 ? '⚡ *Swift (Synchronized)*' :
            latency <= 600 ? '✨ *Stable (Flowing)*' :
              '🌘 *Delayed (Echoing)*';

        // 5. Build the Final Dashboard
        const reply =
          '🌙 *MIDKNIGHT SYSTEM STATUS*\n' +
          '──────────────────\n' +
          `⏱️ *Response:* ${latency}ms\n` +
          `🧠 *RAM:* ${ramUsage} MB / ${totalRam} MB\n` +
          `🖥️ *Host:* ${hostname}\n` +
          `⌛ *Uptime:* ${uptime}\n` +
          `🔮 *State:* ${status}\n` +
          '──────────────────\n' +
          '_The currents shift through unseen realms._';

        // 6. Edit the original message (Seamless transition)
        // If 'keyMsg' exists (message sent successfully), we edit it.
        if (keyMsg) {
          await sock.sendMessage(chat, {
            text: reply,
            edit: keyMsg.key
          });
        } else {
          // Fallback just in case
          await sock.sendMessage(chat, { text: reply }, { quoted: msg });
        }
      } catch (error) {
        console.error('Ping command error:', error);
        await sock.sendMessage(chat, {
          text: `❌ Status check failed: ${error.message}`
        }, { quoted: msg });
      }
    },
  },
};