import axios from 'axios';

export default {
    name: 'pastebin',
    alias: ['paste', 'pb'],

    command: {
        pattern: 'pastebin',
        desc: 'Fetch content from Pastebin URLs',
        category: 'tools',
        react: '📄',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const url = args[0];

            if (!url) {
                return sock.sendMessage(chat, {
                    text: '📄 *Usage:* `.pastebin <url>`\nExample: `.pastebin https://pastebin.com/rkbj0rVu`'
                }, { quoted: msg });
            }

            try {
                await sock.sendMessage(chat, { react: { text: '⏳', key: msg.key } });
                await sock.sendMessage(chat, { text: '📄 *Fetching paste...*' }, { quoted: msg });

                const apiUrl = `https://api.giftedtech.co.ke/api/download/pastebin?apikey=gifted&url=${encodeURIComponent(url)}`;
                const { data } = await axios.get(apiUrl);

                // API likely returns the content directly or in a result object
                // Based on "download" endpoint name, it might be the raw content or a JSON with content
                const result = data.result || data;

                if (!result) throw new Error('No data found');

                // If result is an object, try to find the content field, otherwise assume result is the content
                const content = typeof result === 'object' ? (result.content || result.data || JSON.stringify(result, null, 2)) : result;
                const title = typeof result === 'object' ? (result.title || 'Pastebin') : 'Pastebin Content';

                const report = `╭━━━『 📄 MIDKNIGHT PASTE 』━━━╮
┃
┃ 🔗 *URL:* ${url}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

${content}

_“Shared code.”_`;

                await sock.sendMessage(chat, { text: report }, { quoted: msg });
                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Pastebin Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to fetch paste content.' }, { quoted: msg });
            }
        }
    }
};
