import os from 'os';

export default {
    name: 'uptime',
    alias: ['runtime', 'botuptime'],

    command: {
        pattern: 'uptime',
        desc: 'Show bot uptime and system information',
        category: 'system',
        react: '⏰',

        run: async ({ sock, msg }) => {
            try {
                const chat = msg.key.remoteJid;

                try {
                    await sock.sendMessage(chat, { react: { text: '⏰', key: msg.key } });
                } catch { }

                // Bot uptime
                const uptime = process.uptime();
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor((uptime % 86400) / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);

                let uptimeFormatted = '';
                if (days > 0) uptimeFormatted += `${days}d `;
                if (hours > 0) uptimeFormatted += `${hours}h `;
                if (minutes > 0) uptimeFormatted += `${minutes}m `;
                uptimeFormatted += `${seconds}s`;

                // System uptime
                const sysUptime = os.uptime();
                const sysDays = Math.floor(sysUptime / 86400);
                const sysHours = Math.floor((sysUptime % 86400) / 3600);
                const sysMinutes = Math.floor((sysUptime % 3600) / 60);

                let sysUptimeFormatted = '';
                if (sysDays > 0) sysUptimeFormatted += `${sysDays}d `;
                if (sysHours > 0) sysUptimeFormatted += `${sysHours}h `;
                sysUptimeFormatted += `${sysMinutes}m`;

                // Memory
                const used = process.memoryUsage();
                const heapUsed = Math.round(used.heapUsed / 1024 / 1024);
                const heapTotal = Math.round(used.heapTotal / 1024 / 1024);

                // System memory
                const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
                const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
                const usedMem = (totalMem - freeMem).toFixed(1);

                const message = `╭━━━『 ⏰ MIDKNIGHT UPTIME 』━━━╮

⏰ *Bot Uptime*
${uptimeFormatted}

🖥️ *System Uptime*
${sysUptimeFormatted}

💾 *Bot Memory*
${heapUsed}MB / ${heapTotal}MB

🗄️ *System Memory*
${usedMem}GB / ${totalMem}GB

⚙️ *Node.js*
${process.version}

🏗️ *Platform*
${os.platform()} ${os.arch()}

🔧 *CPU Cores*
${os.cpus().length} core${os.cpus().length > 1 ? 's' : ''}

╰━━━━━━━━━━━━━━━━━━━━━╯

_"Running strong since launch."_`;

                await sock.sendMessage(chat, { text: message }, { quoted: msg });
            } catch (error) {
                console.error('Uptime command failed:', error);
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `❌ Error: ${error.message}`
                }, { quoted: msg });
            }
        }
    }
};
