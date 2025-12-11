import axios from 'axios';
import yts from 'yt-search';
import deluxeUI from '../src/utils/deluxeUI.js';

/* ═══════════════════════════════════════════════════════════════
   YTS - YouTube Search with Multiple API Fallbacks
   ═══════════════════════════════════════════════════════════════ */

// Helper
const react = (sock, msg, emoji) => sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => { });

/* ---------------------------------------------------
   API PROVIDERS FOR YOUTUBE SEARCH (20 Fallbacks)
--------------------------------------------------- */
const searchApis = [
    // Primary: yt-search npm package (local, fastest)
    async (query) => {
        const r = await yts(query);
        return r.videos?.slice(0, 10) || null;
    },
    // API Fallbacks
    async (query) => {
        const r = await axios.get(`https://api.giftedtech.co.ke/api/search/yts?apikey=gifted&query=${encodeURIComponent(query)}`, { timeout: 10000 });
        return r.data?.results || r.data?.result || r.data?.data || null;
    },
    async (query) => {
        const r = await axios.get(`https://api.siputzx.my.id/api/s/youtube?q=${encodeURIComponent(query)}`, { timeout: 10000 });
        return r.data?.data || null;
    },
    async (query) => {
        const r = await axios.get(`https://deliriusapi-official.vercel.app/search/ytsearch?q=${encodeURIComponent(query)}`, { timeout: 10000 });
        return r.data?.data || null;
    },
    async (query) => {
        const r = await axios.get(`https://api.dreaded.site/api/ytsearch?q=${encodeURIComponent(query)}`, { timeout: 10000 });
        return r.data?.result || r.data?.data || null;
    },
    async (query) => {
        const r = await axios.get(`https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(query)}&type=search`, { timeout: 10000 });
        return r.data?.data || null;
    },
    async (query) => {
        const r = await axios.get(`https://api.lolhuman.xyz/api/ytsearch?apikey=GataDios&query=${encodeURIComponent(query)}`, { timeout: 10000 });
        return r.data?.result || null;
    },
    async (query) => {
        const r = await axios.get(`https://api.betabotz.eu.org/api/search/youtube?query=${encodeURIComponent(query)}&apikey=beta`, { timeout: 10000 });
        return r.data?.result || null;
    },
    async (query) => {
        const r = await axios.get(`https://api.dfrdn73.workers.dev/youtube/search?q=${encodeURIComponent(query)}`, { timeout: 10000 });
        return r.data?.result || r.data?.data || null;
    },
    async (query) => {
        const r = await axios.get(`https://api.akuari.my.id/search/youtube?query=${encodeURIComponent(query)}`, { timeout: 10000 });
        return r.data?.result || null;
    }
];

async function searchYouTube(query) {
    for (const searchFn of searchApis) {
        try {
            const results = await searchFn(query);
            if (results && Array.isArray(results) && results.length > 0) {
                return results;
            }
        } catch {
            continue;
        }
    }
    return null;
}

/* ---------------------------------------------------
   FORMAT RESULT
--------------------------------------------------- */
function formatResult(item, index) {
    const title = item.title || 'No Title';
    const url = item.url || item.link || (item.videoId ? `https://youtube.com/watch?v=${item.videoId}` : '');
    const duration = item.timestamp || item.duration || item.durasi || 'Unknown';
    const views = item.views || item.viewCount || '0 views';
    const ago = item.ago || item.uploaded || item.publishedAt || '';
    const channel = item.author?.name || item.channel || item.channelTitle || '';

    let result = `*${index + 1}. ${title}*`;
    if (channel) result += `\n   👤 ${channel}`;
    result += `\n   ⏱️ ${duration}`;
    if (views) result += ` • 👁️ ${views}`;
    if (ago) result += ` • 📅 ${ago}`;
    result += `\n   🔗 ${url}`;

    return result;
}

/* ---------------------------------------------------
   EXPORT
--------------------------------------------------- */
export default {
    name: 'yts',
    alias: ['ytsearch', 'youtube', 'yt'],

    command: {
        pattern: 'yts',
        desc: 'Search YouTube videos',
        category: 'search',
        react: '🔴',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const query = args.join(' ');

            if (!query) {
                return sock.sendMessage(chat, {
                    text: `🔴 *YOUTUBE SEARCH*\n\n*Usage:* \`.yts <query>\`\n\n*Examples:*\n• \`.yts lofi music\`\n• \`.yts alan walker faded\``
                }, { quoted: msg });
            }

            // Show typing indicator
            await sock.sendPresenceUpdate('composing', chat);
            await react(sock, msg, '🔍');

            try {
                const results = await searchYouTube(query);

                if (!results || results.length === 0) {
                    await react(sock, msg, '❌');
                    await sock.sendPresenceUpdate('paused', chat);
                    return sock.sendMessage(chat, {
                        text: deluxeUI.error(`No results found for "${query}"`)
                    }, { quoted: msg });
                }

                // Format top 5 results
                const formatted = results
                    .slice(0, 5)
                    .map((item, i) => formatResult(item, i))
                    .join('\n\n');

                // Get first result thumbnail
                const thumbnail = results[0]?.thumbnail || results[0]?.image || results[0]?.thumbnails?.[0]?.url;

                const resultText = `🔴 *YOUTUBE SEARCH*\n\n🔎 *Query:* ${query}\n📊 *Results:* ${Math.min(results.length, 5)} found\n\n${formatted}\n\n_Use .song <url> or .video <url> to download_`;

                await sock.sendPresenceUpdate('paused', chat);

                if (thumbnail) {
                    await sock.sendMessage(chat, {
                        image: { url: thumbnail },
                        caption: resultText,
                        contextInfo: {
                            externalAdReply: {
                                title: `YouTube: ${query}`,
                                body: `${results.length} results`,
                                sourceUrl: results[0]?.url || 'https://youtube.com',
                                mediaType: 1,
                                renderLargerThumbnail: true,
                                thumbnailUrl: thumbnail
                            }
                        }
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chat, { text: resultText }, { quoted: msg });
                }

                await react(sock, msg, '✅');

            } catch (e) {
                console.error('YTS Error:', e.message);
                await sock.sendPresenceUpdate('paused', chat);
                await react(sock, msg, '❌');
                return sock.sendMessage(chat, {
                    text: deluxeUI.error('Search failed. Try again.')
                }, { quoted: msg });
            }
        }
    }
};
