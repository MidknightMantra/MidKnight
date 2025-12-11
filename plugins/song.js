import yts from 'yt-search';
import axios from 'axios';

/* ═══════════════════════════════════════════════════════════════
   SONG - YouTube MP3 Downloader
   Primary: GiftedTech API (Verified Working)
   ═══════════════════════════════════════════════════════════════ */

const react = (sock, msg, emoji) => sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => { });

/* ---------------------------------------------------
   20+ YOUTUBE MP3 APIs (Parallel Race)
   --------------------------------------------------- */
const apis = [
  // Tier 1: Most Reliable
  { name: 'GiftedTech', getUrl: (u) => `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.result?.url || d?.data?.dl },
  { name: 'DavidCyril', getUrl: (u) => `https://api.davidcyriltech.my.id/download/ytmp3?url=${u}`, extract: (d) => d?.result?.download_url || d?.result?.url },
  { name: 'Siputzx', getUrl: (u) => `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.data?.dl },

  // Tier 2: Good Alternatives  
  { name: 'VAPI', getUrl: (u) => `https://vapis.my.id/api/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },
  { name: 'ZenKey', getUrl: (u) => `https://api.zenkey.my.id/api/download/ytmp3?apikey=zenkey&url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
  { name: 'Betabotz', getUrl: (u) => `https://api.betabotz.eu.org/api/download/ytmp3?url=${encodeURIComponent(u)}&apikey=beta`, extract: (d) => d?.result?.download || d?.result?.url },
  { name: 'Neoxr', getUrl: (u) => `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(u)}&type=audio`, extract: (d) => d?.data?.url },
  { name: 'Aemt', getUrl: (u) => `https://api.aemt.uk.to/download/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },

  // Tier 3: Backup APIs
  { name: 'Itzpire', getUrl: (u) => `https://itzpire.com/download/yt-mp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.data?.url },
  { name: 'Mfrfrancisco', getUrl: (u) => `https://api.mfrfrancisco.me/api/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },
  { name: 'Rynn', getUrl: (u) => `https://api.rfrynn.fun/api/downloader/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.result?.url },
  { name: 'Widipe', getUrl: (u) => `https://widipe.com/download/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.result?.url },
  { name: 'Akuari', getUrl: (u) => `https://api.akuari.my.id/downloader/youtube-audio?link=${encodeURIComponent(u)}`, extract: (d) => d?.result?.url || d?.data?.url },
  { name: 'Vrfrv', getUrl: (u) => `https://api.vrfrv.eu.org/api/youtube/download/audio?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },

  // Tier 4: Additional Fallbacks
  { name: 'Lolhuman', getUrl: (u) => `https://api.lolhuman.xyz/api/ytmp3?apikey=free&url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.link },
  { name: 'Zeks', getUrl: (u) => `https://api.zeks.me/api/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
  { name: 'Btchx', getUrl: (u) => `https://btch.us.kg/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download || d?.url },
  { name: 'Ryzendesu', getUrl: (u) => `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
  { name: 'Nyxs', getUrl: (u) => `https://api.nyxs.pw/dl/yt-audio?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.url || d?.url },
  { name: 'Shannmoderz', getUrl: (u) => `https://api.shannmoderz.xyz/api/ytmp3?url=${encodeURIComponent(u)}`, extract: (d) => d?.result?.download_url || d?.url },
];

/**
 * Smart Race: Fires requests to all APIs.
 * Tries to download from the first success.
 * If download fails, keeps trying others until one works or all fail.
 */
async function getAudioBuffer(videoUrl) {
  const apiPromises = apis.map(async (api) => {
    try {
      const { data } = await axios.get(api.getUrl(videoUrl), { timeout: 8000 });
      const url = api.extract(data);
      if (url && url.startsWith('http')) {
        return { url, name: api.name };
      }
    } catch { } // Ignore API errors, just return undefined
    return null;
  });

  // We want to process these as they arrive, not wait for all
  // But standard Promise functions don't quite filter + cascading fallback easily.
  // Implementation: Wrap each API promise to ALSO actually download the buffer

  const contentPromises = apiPromises.map(async (p) => {
    const source = await p;
    if (!source) throw new Error('No URL');

    // Try to download
    try {
      const res = await axios.get(source.url, { responseType: 'arraybuffer', timeout: 90000 });
      if (res.data) return { buffer: Buffer.from(res.data), source: source.name, title: source.title };
    } catch { }
    throw new Error('Download failed');
  });

  try {
    // Return the FIRST successful buffer download (fastest working path)
    return await Promise.any(contentPromises);
  } catch {
    return null; // All failed
  }
}

export default {
  name: 'song',
  alias: ['play', 'music', 'mp3', 'audio', 'ytmp3'],
  desc: 'Download songs from YouTube',
  category: 'downloader',
  react: '🎵',

  command: {
    pattern: 'song',
    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const query = args.join(' ');

      if (!query) return sock.sendMessage(chat, { text: `🎵 *Usage:* \`.song <title>\`` }, { quoted: msg });

      await react(sock, msg, '🔍');
      try {
        // 1. Search
        const search = await yts(query);
        const video = search.videos?.[0];
        if (!video) return sock.sendMessage(chat, { text: '❌ No results found.' }, { quoted: msg });

        if (video.seconds > 900) {
          return sock.sendMessage(chat, { text: '❌ Song too long (Max 15 mins).' }, { quoted: msg });
        }

        await react(sock, msg, '⬇️');

        // 2. Smart Download (Race)
        const result = await getAudioBuffer(video.url);
        if (!result) {
          await react(sock, msg, '❌');
          return sock.sendMessage(chat, { text: '❌ Failed to download song. All servers busy.' }, { quoted: msg });
        }

        const { buffer, source } = result;

        // Validate buffer is not corrupted (minimum size check)
        if (!buffer || buffer.length < 100000) { // Less than 100KB is likely corrupted
          await react(sock, msg, '❌');
          return sock.sendMessage(chat, { text: '❌ Downloaded file appears corrupted. Try again.' }, { quoted: msg });
        }

        await react(sock, msg, '⬆️');

        // 3. Send as Audio Message (better compatibility than document)
        const safeTitle = video.title.replace(/[<>:"/\\|?*]/g, '').substring(0, 60);

        await sock.sendMessage(chat, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: false, // Send as audio file, not voice note
          fileName: `${safeTitle}.mp3`,
          contextInfo: {
            externalAdReply: {
              title: video.title,
              body: `${video.author.name} • ${video.timestamp}`,
              thumbnailUrl: video.thumbnail,
              sourceUrl: video.url,
              mediaType: 2,
              renderLargerThumbnail: true
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
