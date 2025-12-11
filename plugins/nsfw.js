import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'nsfw',
    alias: ['xvideos', 'xnxx', 'porn', 'sex', 'xvideosdl', 'xnxxdl', 'pussy', 'cuckold', 'yuri', 'milf', 'blowjob'],

    command: {
        pattern: 'nsfw',
        desc: 'Search or download adult content (Xvideos, XNXX)',
        category: 'nsfw',
        react: '🔞',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const cmd = textContent.split(' ')[0].slice(1).toLowerCase();

            // REBIX NSFW CATEGORIES
            const rebixCategories = ['pussy', 'cuckold', 'yuri', 'milf', 'blowjob'];
            if (rebixCategories.includes(cmd)) {
                try {
                    await sock.sendMessage(chat, { react: { text: '🔞', key: msg.key } });
                    await sock.sendMessage(chat, { text: '🔞 *Midknight is fetching...*' }, { quoted: msg });

                    const apiUrl = `https://api-rebix.zone.id/api/nsfw/${cmd}`;
                    const response = await axios.get(apiUrl);
                    const data = response.data?.result || response.data;

                    if (!data || !data.url) {
                        throw new Error('Content not found');
                    }

                    const imageUrl = data.url || data.image || data.link;

                    // Send image with caption
                    await sock.sendMessage(chat, {
                        image: { url: imageUrl },
                        caption: `╭━━━『 🔞 MIDKNIGHT ${cmd.toUpperCase()} 』━━━╮
┃
┃ 📂 *Category:* ${cmd}
┃ 🔗 *Source:* Rebix API
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"Strictly 18+"_`
                    }, { quoted: msg });

                    try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

                } catch (e) {
                    console.error('NSFW Category Error:', e);
                    return sock.sendMessage(chat, { text: '❌ Failed to fetch content.' }, { quoted: msg });
                }
                return;
            }

            // DOWNLOAD MODE
            if (cmd === 'xvideosdl' || cmd === 'xnxxdl') {
                const url = args[0];
                if (!url) {
                    return sock.sendMessage(chat, {
                        text: `🔞 *Usage:* \`.${cmd} <url>\`\nExample: \`.${cmd} https://...\``
                    }, { quoted: msg });
                }

                try {
                    await sock.sendMessage(chat, { react: { text: '📥', key: msg.key } });
                    await sock.sendMessage(chat, { text: '📥 *Midknight is downloading...*' }, { quoted: msg });

                    const endpoint = cmd === 'xnxxdl' ? 'xnxxdl' : 'xvideosdl';
                    const apiUrl = `https://api.giftedtech.co.ke/api/download/${endpoint}?apikey=gifted&url=${encodeURIComponent(url)}`;

                    const response = await axios.get(apiUrl);
                    const data = response.data?.result || response.data;

                    if (!data || !data.download_url) {
                        throw new Error('Video not found');
                    }

                    const title = data.title || 'Video';
                    const downloadUrl = data.download_url || data.url;
                    const thumbnail = data.thumbnail || data.image;

                    // Send thumbnail & info
                    const caption = `╭━━━『 🔞 MIDKNIGHT DOWNLOAD 』━━━╮
┃
┃ 📹 *Title:* ${title}
┃ 🔗 *Link:* ${downloadUrl}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"Strictly 18+"_`;

                    if (thumbnail) {
                        await sock.sendMessage(chat, {
                            image: { url: thumbnail },
                            caption: caption
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chat, { text: caption }, { quoted: msg });
                    }

                    // Send video file
                    await sock.sendMessage(chat, {
                        video: { url: downloadUrl },
                        caption: `🔞 *${title}*\n\n_"Strictly 18+"_`
                    }, { quoted: msg });

                    try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

                } catch (e) {
                    console.error('NSFW Download Error:', e);
                    return sock.sendMessage(chat, { text: '❌ Failed to download video.' }, { quoted: msg });
                }
                return;
            }

            // SEARCH MODE (Existing)
            // Determine provider based on command or default to xvideos
            let provider = 'xvideos';
            if (cmd.includes('xnxx')) provider = 'xnxx';

            const query = args.join(' ');

            if (!query) {
                return sock.sendMessage(chat, {
                    text: `🔞 *Usage:* \`.${provider} <query>\`\nExample: \`.${provider} step mom\`\n\nOr download:\n\`.xvideosdl <url>\`\n\`.xnxxdl <url>\``
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '🔞', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '🔞 *Midknight is searching...*' }, { quoted: msg });

            try {
                const endpoint = provider === 'xnxx' ? 'xnxxsearch' : 'xvideossearch';
                const apiUrl = `https://api.giftedtech.co.ke/api/search/${endpoint}?apikey=gifted&query=${encodeURIComponent(query)}`;

                const response = await axios.get(apiUrl);
                const results = response.data?.result || response.data;

                if (!results || (Array.isArray(results) && results.length === 0)) {
                    throw new Error('No results found');
                }

                // Format Results
                let formatted = '';

                if (Array.isArray(results)) {
                    formatted = results.slice(0, 5).map((item) => {
                        const title = item.title || 'No Title';
                        const link = item.link || item.url || '#';
                        const duration = item.duration || item.time || '';
                        return `🔹 *${title}*\n🔗 ${link}\n⏱️ ${duration}`;
                    }).join('\n\n');
                } else {
                    formatted = `🔹 *${results.title || 'Result'}*\n🔗 ${results.link || results.url}`;
                }

                await sock.sendMessage(chat, {
                    text: `╭━━━『 🔞 MIDKNIGHT ${provider.toUpperCase()} 』━━━╮
┃
┃ 🔎 *Query:* ${query}
┃
${formatted}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"Strictly 18+"_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('NSFW Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to search content.' }, { quoted: msg });
            }
        },
    },
};
