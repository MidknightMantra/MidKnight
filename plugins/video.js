import yts from 'yt-search';
import axios from 'axios';

/* ═══════════════════════════════════════════════════════════════
   VIDEO - YouTube Video Downloader
   Primary: GiftedTech API (Verified Working)
   ═══════════════════════════════════════════════════════════════ */

const react = (sock, msg, emoji) => sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => { });

/* ---------------------------------------------------
   20+ YOUTUBE MP4 APIs (Parallel Race)
   --------------------------------------------------- */
const apis = [
  // Tier 1: Most Reliable
  { name: 'GiftedTech', getUrl: (u) => `https://api.giftedtech.co.ke/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.result?.url },
  { name: 'DavidCyril', getUrl: (u) => `https://api.davidcyriltech.my.id/download/ytmp4?url=${u}`, extract: (d) => d?.result?.download_url || d?.result?.url },
  { name: 'Siputzx', getUrl: (u) => `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.data?.dl },

  // Tier 2: Good Alternatives  
  { name: 'VAPI', getUrl: (u) => `https://vapis.my.id/api/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },
  { name: 'ZenKey', getUrl: (u) => `https://api.zenkey.my.id/api/download/ytmp4?apikey=zenkey&url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
  { name: 'Betabotz', getUrl: (u) => `https://api.betabotz.eu.org/api/download/ytmp4?url=${encodeURIComponent(u)}&apikey=beta`, extract: (d) => d?.result?.download || d?.result?.url },
  { name: 'Neoxr', getUrl: (u) => `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(u)}&type=video`, extract: (d) => d?.data?.url },
  { name: 'Aemt', getUrl: (u) => `https://api.aemt.uk.to/download/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },

  // Tier 3: Backup APIs
  { name: 'Itzpire', getUrl: (u) => `https://itzpire.com/download/yt-mp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.data?.url },
  { name: 'Mfrfrancisco', getUrl: (u) => `https://api.mfrfrancisco.me/api/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },
  { name: 'Rynn', getUrl: (u) => `https://api.rfrynn.fun/api/downloader/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.result?.url },
  { name: 'Widipe', getUrl: (u) => `https://widipe.com/download/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.result?.url },
  { name: 'Akuari', getUrl: (u) => `https://api.akuari.my.id/downloader/youtube-video?link=${encodeURIComponent(u)}`, extract: (d) => d?.result?.url || d?.data?.url },
  { name: 'Vrfrv', getUrl: (u) => `https://api.vrfrv.eu.org/api/youtube/download/video?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },

  // Tier 4: Additional Fallbacks
  { name: 'Lolhuman', getUrl: (u) => `https://api.lolhuman.xyz/api/ytmp4?apikey=free&url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.link },
  { name: 'Zeks', getUrl: (u) => `https://api.zeks.me/api/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
  { name: 'Btchx', getUrl: (u) => `https://btch.us.kg/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },
  { name: 'Ryzendesu', getUrl: (u) => `https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
  { name: 'Nyxs', getUrl: (u) => `https://api.nyxs.pw/dl/yt-video?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.url || d?.url },
  { name: 'Shannmoderz', getUrl: (u) => `https://api.shannmoderz.xyz/api/ytmp4?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
];

/**
 * Smart Race: Fires requests to all APIs.
 * Tries to download from the first success.
 * If download fails, keeps trying others until one works or all fail.
 */
async function getVideoBuffer(videoUrl) {
  const apiPromises = apis.map(async (api) => {
    try {
      const { data } = await axios.get(api.getUrl(videoUrl), { timeout: 8000 });
      const url = api.extract(data);
      if (url && url.startsWith('http')) {
        return { url, name: api.name };
      }
    } catch { }
    return null;
  });

  const contentPromises = apiPromises.map(async (p) => {
    const source = await p;
    if (!source) throw new Error('No URL');

    try {
      const res = await axios.get(source.url, { responseType: 'arraybuffer', timeout: 120000 });
      if (res.data) return { buffer: Buffer.from(res.data), source: source.name };
    } catch { }
    throw new Error('Download failed');
  });

  try {
    return await Promise.any(contentPromises);
  } catch {
    return null;
  }
}

export default {
  name: 'video',
  alias: ['ytv', 'mp4', 'v', 'ytvideo'],
  desc: 'Download YouTube videos',
  category: 'downloader',
  react: '🎬',

  command: {
    pattern: 'video',
    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const query = args.join(' ');

      if (!query) return sock.sendMessage(chat, { text: `🎬 *Usage:* \`.video <title>\`` }, { quoted: msg });

      await react(sock, msg, '🔍');
      try {
        // 1. Search
        const search = await yts(query);
        const video = search.videos?.[0];
        if (!video) return sock.sendMessage(chat, { text: '❌ No results found.' }, { quoted: msg });

        if (video.seconds > 1800) {
          return sock.sendMessage(chat, { text: '❌ Video too long (Max 30 mins).' }, { quoted: msg });
        }

        await react(sock, msg, '⬇️');

        // 2. Smart Download (Race)
        const result = await getVideoBuffer(video.url);
        if (!result) {
          await react(sock, msg, '❌');
          return sock.sendMessage(chat, { text: '❌ Failed to download video. All servers busy.' }, { quoted: msg });
        }

        const { buffer, source } = result;

        await react(sock, msg, '⬆️');

        // 3. Send
        await sock.sendMessage(chat, {
          video: buffer,
          caption: `🎬 *${video.title}*\n👤 ${video.author.name}\n⏱️ ${video.timestamp}\n📦 Source: ${source}`,
          mimetype: 'video/mp4',
          contextInfo: {
            externalAdReply: {
              title: video.title,
              body: video.author.name,
              thumbnailUrl: video.thumbnail,
              sourceUrl: video.url,
              mediaType: 2
            }
          }
        }, { quoted: msg });

        await react(sock, msg, '✅');

      } catch (e) {
        console.error(e);
        await react(sock, msg, '❌');
        return sock.sendMessage(chat, { text: `❌ Error: ${e.message}` }, { quoted: msg });
      }
    }
  }
};
