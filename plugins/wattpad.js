import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'wattpad',
    alias: ['wp', 'story', 'read'],

    command: {
        pattern: 'wattpad',
        desc: 'Search for stories on Wattpad',
        category: 'search',
        react: '📖',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const query = args.join(' ');

            if (!query) {
                return sock.sendMessage(chat, {
                    text: '📖 *Usage:* `.wattpad <query>`\nExample: `.wattpad Romance`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '📖', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '📖 *Midknight is searching Wattpad...*' }, { quoted: msg });

            try {
                const apiUrl = `https://api.giftedtech.co.ke/api/search/wattpad?apikey=gifted&query=${encodeURIComponent(query)}`;

                const response = await axios.get(apiUrl);
                const results = response.data?.results || response.data?.result || response.data;

                if (!results || (Array.isArray(results) && results.length === 0)) {
                    throw new Error('No stories found');
                }

                // Format Results
                let formatted = '';

                if (Array.isArray(results)) {
                    formatted = results.slice(0, 5).map((item) => {
                        const title = item.tittle || item.title || 'No Title';  // API uses 'tittle' (typo)
                        const link = item.link || item.url || '#';
                        const reads = item.reads || item.readCount || '0';
                        const votes = item.likes || item.votes || item.voteCount || '0';  // API uses 'likes'
                        return `🔹 *${title}*\n🔗 ${link}\n👁️ ${reads} | ⭐ ${votes}`;
                    }).join('\n\n');
                } else {
                    const title = results.tittle || results.title || 'Story';
                    const link = results.link || results.url || '#';
                    const reads = results.reads || '0';
                    const votes = results.likes || results.votes || '0';
                    formatted = `🔹 *${title}*\n🔗 ${link}\n👁️ ${reads} | ⭐ ${votes}`;
                }

                await sock.sendMessage(chat, {
                    text: `╭━━━『 📖 MIDKNIGHT WATTPAD 』━━━╮
┃
┃ 🔎 *Query:* ${query}
┃
${formatted}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Stories that live.”_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Wattpad Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to search Wattpad.' }, { quoted: msg });
            }
        },
    },
};
