import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'npm',
    alias: ['pkg', 'package', 'node'],

    command: {
        pattern: 'npm',
        desc: 'Search for NPM packages',
        category: 'search',
        react: '📦',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const query = args.join(' ');

            if (!query) {
                return sock.sendMessage(chat, {
                    text: '📦 *Usage:* `.npm <package_name>`\nExample: `.npm axios`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '📦', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '📦 *Midknight is searching registry...*' }, { quoted: msg });

            try {
                const apiUrl = `https://api.giftedtech.co.ke/api/search/npmsearch?apikey=gifted&packagename=${encodeURIComponent(query)}`;

                const response = await axios.get(apiUrl);
                const results = response.data?.result || response.data;

                if (!results || (Array.isArray(results) && results.length === 0)) {
                    throw new Error('No packages found');
                }

                // Format Results
                let formatted = '';

                if (Array.isArray(results)) {
                    formatted = results.slice(0, 5).map((item) => {
                        const name = item.name || item.package || 'No Name';
                        const link = item.link || item.url || `https://www.npmjs.com/package/${name}`;
                        const desc = item.description || item.desc || 'No description';
                        const ver = item.version || 'latest';
                        return `🔹 *${name}* (v${ver})\n🔗 ${link}\n📝 ${desc}`;
                    }).join('\n\n');
                } else {
                    const name = results.name || query;
                    const link = results.link || results.url || `https://www.npmjs.com/package/${name}`;
                    formatted = `🔹 *${name}*\n🔗 ${link}\n📝 ${results.description || 'No description'}`;
                }

                await sock.sendMessage(chat, {
                    text: `╭━━━『 📦 MIDKNIGHT NPM 』━━━╮
┃
┃ 🔎 *Query:* ${query}
┃
${formatted}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Build with the best.”_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('NPM Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to search NPM.' }, { quoted: msg });
            }
        },
    },
};
