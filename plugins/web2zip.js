import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'web2zip',
    alias: ['websource', 'dksite', 'clone'],

    command: {
        pattern: 'web2zip',
        desc: 'Download website source code as ZIP',
        category: 'tools',
        react: '📦',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const url = args[0];

            if (!url) {
                return sock.sendMessage(chat, {
                    text: '📦 *Usage:* `.web2zip <url>`\nExample: `.web2zip https://google.com`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '📦', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '📦 *Midknight is archiving the web...*' }, { quoted: msg });

            try {
                const apiUrl = `https://api.giftedtech.co.ke/api/tools/web2zip?apikey=gifted&url=${encodeURIComponent(url)}`;

                // Fetch JSON first to get the download URL
                const response = await axios.get(apiUrl, { timeout: 30000 });

                const downloadUrl = response.data?.result?.download_url || response.data?.download_url;

                if (!downloadUrl) {
                    throw new Error('No download URL returned');
                }

                // Now fetch the file buffer
                const fileRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

                // Send as Document
                await sock.sendMessage(chat, {
                    document: fileRes.data,
                    mimetype: 'application/zip',
                    fileName: `Midknight_WebArchive_${Date.now()}.zip`,
                    caption: `╭━━━『 📦 MIDKNIGHT ARCHIVE 』━━━╮
┃
┃ 🌐 *Target:* ${url}
┃ 💾 *Size:* ${(fileRes.data.length / 1024 / 1024).toFixed(2)} MB
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“The internet, compressed.”_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Web2Zip Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to archive website. It might be protected.' }, { quoted: msg });
            }
        },
    },
};
