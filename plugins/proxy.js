import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'proxy',
    alias: ['getproxy', 'proxies'],

    command: {
        pattern: 'proxy',
        desc: 'Generate a fresh proxy list',
        category: 'tools',
        react: '🌐',

        run: async ({ sock, msg }) => {
            const chat = msg.key.remoteJid;

            // React
            try { await sock.sendMessage(chat, { react: { text: '🌐', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '🌐 *Midknight is routing...*' }, { quoted: msg });

            try {
                const apiUrl = `https://api.giftedtech.co.ke/api/tools/proxy?apikey=gifted`;

                const response = await axios.get(apiUrl);

                // The API likely returns a list of proxies in text or JSON format.
                // Let's handle both.
                let proxyList = '';

                if (typeof response.data === 'string') {
                    proxyList = response.data;
                } else if (response.data.result) {
                    proxyList = response.data.result;
                } else if (Array.isArray(response.data)) {
                    proxyList = response.data.join('\n');
                } else {
                    proxyList = JSON.stringify(response.data, null, 2);
                }

                if (!proxyList) {
                    throw new Error('No proxies returned');
                }

                // Send as Document (Proxy lists can be long)
                // Or text if short. Let's default to text if < 2000 chars, else document.

                if (proxyList.length < 2000) {
                    await sock.sendMessage(chat, {
                        text: `╭━━━『 🌐 MIDKNIGHT PROXY 』━━━╮
┃
${proxyList}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Mask your footprint.”_`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chat, {
                        document: Buffer.from(proxyList),
                        mimetype: 'text/plain',
                        fileName: `Midknight_Proxies_${Date.now()}.txt`,
                        caption: `╭━━━『 🌐 MIDKNIGHT PROXY 』━━━╮
┃
┃ 💾 *Count:* ${proxyList.split('\n').length} Proxies
┃ 🔒 *Type:* Mixed
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Mask your footprint.”_`
                    }, { quoted: msg });
                }

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Proxy Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to fetch proxies.' }, { quoted: msg });
            }
        },
    },
};
