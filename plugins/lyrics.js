import axios from 'axios';

/* -------------------------------------------------------
   HELPER: Clean Search Query
------------------------------------------------------- */
function cleanQuery(text) {
  return text
    .replace(/official video/gi, '')
    .replace(/official audio/gi, '')
    .replace(/lyrics/gi, '')
    .replace(/ft\./gi, '')
    .replace(/feat\./gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/hq/gi, '')
    .replace(/hd/gi, '')
    .replace(/4k/gi, '')
    .trim();
}

/* -------------------------------------------------------
   HELPER: iTunes Album Art Fetcher
   Finds high-res album art if the lyrics API didn't provide one.
------------------------------------------------------- */
async function fetchAlbumArt(artist, title) {
  try {
    const query = `${artist} ${title}`;
    const { data } = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`);
    if (data.resultCount > 0) {
      // iTunes returns 100x100 by default. We hack the URL to get 600x600 (High Res).
      return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
    }
  } catch (e) {
    return null;
  }
  return null;
}

/* -------------------------------------------------------
   HELPER: Standardizer
------------------------------------------------------- */
const formatLyrics = async (title, artist, lyrics, image) => {
  let finalImage = image;

  // If no image provided by the Lyrics API, ask iTunes
  if (!finalImage || !finalImage.startsWith('http')) {
    finalImage = await fetchAlbumArt(artist, title);
  }

  // Fallback if iTunes also fails
  if (!finalImage) {
    finalImage = 'https://i.imgur.com/ImSaOaJ.jpeg';
  }

  return {
    title: title || 'Unknown Title',
    artist: artist || 'Unknown Artist',
    lyrics: lyrics || 'No text found.',
    image: finalImage
  };
};

/* -------------------------------------------------------
   API 0: GiftedTech (Priority)
------------------------------------------------------- */
async function engineGifted(q) {
  try {
    // Try V2 first
    let { data } = await axios.get(`https://api.giftedtech.co.ke/api/search/lyricsv2?apikey=gifted&query=${encodeURIComponent(q)}`);
    if (data.result || data.lyrics) {
      return await formatLyrics(data.title || q, data.artist || 'Unknown', data.lyrics || data.result, data.image || data.thumbnail);
    }

    // Fallback to V1
    ({ data } = await axios.get(`https://api.giftedtech.co.ke/api/search/lyrics?apikey=gifted&query=${encodeURIComponent(q)}`));
    if (data.result || data.lyrics) {
      return await formatLyrics(data.title || q, data.artist || 'Unknown', data.lyrics || data.result, data.image || data.thumbnail);
    }
  } catch (e) { }
  return null;
}

/* -------------------------------------------------------
   API 1: RyzenDesu (Genius)
------------------------------------------------------- */
async function engineGenius(q) {
  try {
    const { data } = await axios.get(`https://api.ryzendesu.vip/api/search/lyrics?query=${encodeURIComponent(q)}`, { timeout: 10000 });
    if (data.success && data.data) {
      return await formatLyrics(data.data.title, data.data.artist, data.data.lyrics, data.data.image);
    }
  } catch (e) { }
  return null;
}

/* -------------------------------------------------------
   API 2: Delirius (Backup)
------------------------------------------------------- */
async function engineDelirius(q) {
  try {
    const { data } = await axios.get(`https://delirius-api-oficial.vercel.app/api/search/lyrics?query=${encodeURIComponent(q)}`, { timeout: 10000 });
    if (data.data) {
      return await formatLyrics(data.data.title, data.data.artist, data.data.lyrics, data.data.image);
    }
  } catch (e) { }
  return null;
}

/* -------------------------------------------------------
   API 3: Lrclib (Fast - No native image)
------------------------------------------------------- */
async function engineLrclib(q) {
  try {
    const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, { timeout: 8000 });
    const track = data.find(t => t.plainLyrics) || data[0];

    if (track && track.plainLyrics) {
      // Lrclib has NO image, so we pass null. 
      // The formatLyrics helper will see 'null' and automatically fetch from iTunes.
      return await formatLyrics(track.trackName, track.artistName, track.plainLyrics, null);
    }
  } catch (e) { }
  return null;
}

/* -------------------------------------------------------
   API 4: GiftedTech Chord (Chord Search)
------------------------------------------------------- */
async function fetchChord(q) {
  try {
    const { data } = await axios.get(`https://api.giftedtech.co.ke/api/search/chord?apikey=gifted&query=${encodeURIComponent(q)}`);
    const result = data.result || data;
    if (result && result.chord) {
      return {
        title: result.title || q,
        artist: result.artist || 'Unknown',
        chord: result.chord,
        image: result.image || null
      };
    }
  } catch (e) { }
  return null;
}

/* -------------------------------------------------------
   MASTER CONTROLLER
------------------------------------------------------- */
async function waterfallLyrics(rawQuery) {
  const refinedQuery = cleanQuery(rawQuery);

  // 0. Try GiftedTech
  let res = await engineGifted(refinedQuery);
  if (res) return res;

  // 1. Try Genius
  res = await engineGenius(refinedQuery);
  if (res) return res;

  // 2. Try Delirius
  res = await engineDelirius(refinedQuery);
  if (res) return res;

  // 3. Try Lrclib (Will auto-fetch art from iTunes)
  res = await engineLrclib(refinedQuery);
  if (res) return res;

  return null;
}

export default {
  name: 'lyrics',
  alias: ['lyric', 'words', 'sing', 'chord', 'chords'],

  command: {
    pattern: 'lyrics',
    desc: 'Fetch lyrics or chords',
    category: 'media',
    react: '🎤',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const cmd = textContent.split(' ')[0].slice(1).toLowerCase();
      const query = args.join(' ');

      if (!query) {
        return await sock.sendMessage(chat, {
          text: `🎤 *Usage:* \`.${cmd} <song name>\`\nExample: \`.${cmd} Spectre\``
        }, { quoted: msg });
      }

      try { await sock.sendMessage(chat, { react: { text: '🎶', key: msg.key } }); } catch { }

      try {
        if (cmd === 'chord' || cmd === 'chords') {
          // Chord Mode
          const data = await fetchChord(query);
          if (!data) {
            return await sock.sendMessage(chat, { text: `❌ *Not Found*\n\nCould not find chords for "${query}".` }, { quoted: msg });
          }

          const report = `╭━━━『 🎸 MIDKNIGHT CHORDS 』━━━╮
┃
┃ 🎵 *Title:* ${data.title}
┃ 👤 *Artist:* ${data.artist}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

${data.chord.trim()}

_“Strum the strings.”_`;

          // Use image if available, else just text
          if (data.image) {
            await sock.sendMessage(chat, { image: { url: data.image }, caption: report }, { quoted: msg });
          } else {
            await sock.sendMessage(chat, { text: report }, { quoted: msg });
          }

        } else {
          // Lyrics Mode
          const data = await waterfallLyrics(query);

          if (!data) {
            return await sock.sendMessage(chat, { text: `❌ *Not Found*\n\nCould not find lyrics for "${query}".` }, { quoted: msg });
          }

          const report = `╭━━━『 🎤 MIDKNIGHT LYRICS 』━━━╮
┃
┃ 🎵 *Title:* ${data.title}
┃ 👤 *Artist:* ${data.artist}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

${data.lyrics.trim()}

_“Music is life.”_`;

          // Always send image because we now have iTunes fallback
          await sock.sendMessage(chat, {
            image: { url: data.image },
            caption: report
          }, { quoted: msg });
        }

        try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

      } catch (error) {
        console.error('Lyrics/Chord Error:', error.message);
        await sock.sendMessage(chat, { text: '❌ System Error.' }, { quoted: msg });
      }
    }
  }
};