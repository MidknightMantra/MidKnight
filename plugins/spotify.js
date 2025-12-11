import axios from 'axios';
import deluxeUI from '../src/utils/deluxeUI.js';

/* -------------------------------------------------------
   ENGINE 1: GIFTED TECH DOWNLOAD
------------------------------------------------------- */
async function engineGiftedDL(url) {
    try {
        const apiUrl = `https://api.giftedtech.co.ke/api/download/spotifydl?apikey=gifted&url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { timeout: 15000 });
        const data = response.data?.result || response.data;

        if (data && data.download_url) {
            return {
                title: data.title || data.name || 'Unknown Track',
                artist: data.artist || data.artists || 'Unknown Artist',
                downloadUrl: data.download_url || data.url,
                thumbnail: data.thumbnail || data.image || data.cover,
                source: 'GiftedTech'
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

/* -------------------------------------------------------
   ENGINE 2: DELIRIUS DOWNLOAD
------------------------------------------------------- */
async function engineDeliriusDL(url) {
    try {
        const apiUrl = `https://delirius-api-oficial.vercel.app/api/spotifydl?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { timeout: 15000 });
        const data = response.data?.data || response.data?.result || response.data;

        if (data && data.url) {
            return {
                title: data.title || data.name || 'Unknown Track',
                artist: data.artist || data.artists || 'Unknown Artist',
                downloadUrl: data.url || data.download,
                thumbnail: data.thumbnail || data.image,
                source: 'Delirius'
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

/* -------------------------------------------------------
   ENGINE 3: GIFTED TECH SEARCH
------------------------------------------------------- */
async function engineGiftedSearch(query) {
    try {
        const apiUrl = `https://api.giftedtech.co.ke/api/search/spotifysearch?apikey=gifted&query=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 10000 });
        const results = response.data?.result || response.data?.results || response.data;

        if (results && Array.isArray(results) && results.length > 0) {
            return {
                results: results.slice(0, 5),
                source: 'GiftedTech'
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

/* -------------------------------------------------------
   ENGINE 4: RYZEN SEARCH
------------------------------------------------------- */
async function engineRyzenSearch(query) {
    try {
        const apiUrl = `https://api.ryzendesu.vip/api/search/spotify?query=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 10000 });

        if (response.data?.success && response.data?.data) {
            return {
                results: Array.isArray(response.data.data) ? response.data.data.slice(0, 5) : [response.data.data],
                source: 'Ryzen'
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'spotify',
    alias: ['spot', 'music', 'sp', 'spotifydl', 'spdl'],

    command: {
        pattern: 'spotify',
        desc: 'Search or download Spotify tracks (Multi-Engine)',
        category: 'search',
        react: '🎧',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const cmd = textContent.split(' ')[0].slice(1).toLowerCase();
            const query = args.join(' ');

            // DOWNLOAD MODE
            if (cmd === 'spotifydl' || cmd === 'spdl') {
                const url = args[0];
                if (!url || !url.includes('spotify.com')) {
                    return sock.sendMessage(chat, {
                        text: '🎧 *Usage:* `.spotifydl <url>`\nExample: `.spotifydl https://open.spotify.com/track/...`'
                    }, { quoted: msg });
                }

                try {
                    await sock.sendMessage(chat, { react: { text: '📥', key: msg.key } });
                    await sock.sendMessage(chat, { text: '🎧 *Downloading from Spotify...*' }, { quoted: msg });

                    // Waterfall: Try each download engine
                    let data = null;
                    if (!data) data = await engineGiftedDL(url);
                    if (!data) data = await engineDeliriusDL(url);

                    if (!data || !data.downloadUrl) {
                        throw new Error('Track not found on any service');
                    }

                    // Send thumbnail & info
                    const caption = `╭━━━『 🎧 MIDKNIGHT SPOTIFY 』━━━╮
┃
┃ 🎵 *Title:* ${data.title}
┃ 👤 *Artist:* ${data.artist}
┃ ⚙️ *Engine:* ${data.source}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"Music for every mood."_`;

                    if (data.thumbnail) {
                        await sock.sendMessage(chat, {
                            image: { url: data.thumbnail },
                            caption: caption
                        }, { quoted: msg });
                    }

                    // Send audio file
                    await sock.sendMessage(chat, {
                        audio: { url: data.downloadUrl },
                        mimetype: 'audio/mpeg',
                        fileName: `${data.title}.mp3`
                    }, { quoted: msg });

                    try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

                } catch (e) {
                    console.error('Spotify Download Error:', e);
                    return sock.sendMessage(chat, { text: '❌ Failed to download track from all sources.' }, { quoted: msg });
                }
                return;
            }

            // SEARCH MODE
            if (!query) {
                return sock.sendMessage(chat, {
                    text: '🎧 *Usage:* `.spotify <query>`\nExample: `.spotify Spectre`\n\nOr download:\n`.spotifydl <url>`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '🎧', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '🎧 *Midknight is searching Spotify...*' }, { quoted: msg });

            try {
                // Waterfall: Try each search engine
                let searchData = null;
                if (!searchData) searchData = await engineGiftedSearch(query);
                if (!searchData) searchData = await engineRyzenSearch(query);

                if (!searchData || !searchData.results || searchData.results.length === 0) {
                    throw new Error('No tracks found on any service');
                }

                // Format Results
                const formatted = searchData.results.map((item) => {
                    const title = item.title || item.name || 'No Title';
                    const url = item.url || item.link || item.external_urls?.spotify || '#';
                    const artist = item.artist || (item.artists ? (Array.isArray(item.artists) ? item.artists[0]?.name : item.artists) : 'Unknown');
                    const duration = item.duration || (item.duration_ms ? (item.duration_ms / 60000).toFixed(2) + 'm' : '');
                    const popularity = item.popularity ? `🔥 ${item.popularity}` : '';

                    return `🔹 *${title}*\n👤 ${artist}\n🔗 ${url}\n⏱️ ${duration} ${popularity}`;
                }).join('\n\n');

                await sock.sendMessage(chat, {
                    text: `╭━━━『 🎧 MIDKNIGHT SPOTIFY 』━━━╮
┃
┃ 🔎 *Query:* ${query}
┃ ⚙️ *Engine:* ${searchData.source}
┃
${formatted}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"Music for every mood."_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Spotify Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to search Spotify on all services.' }, { quoted: msg });
            }
        },
    },
};
