import axios from 'axios';

/* -------------------------------------------------------
   API 0: GiftedTech Providers (Priority)
------------------------------------------------------- */
async function shortGifted(url, type) {
  try {
    const { data } = await axios.get(`https://api.giftedtech.co.ke/api/tools/${type}?apikey=gifted&url=${encodeURIComponent(url)}`);
    // Some endpoints return { result: "url" }, others { url: "url" }, or just text
    const res = data.result || data.url || data;
    if (typeof res === 'string' && res.startsWith('http')) return res;
    return null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------
   API 1: TinyURL (Backup)
------------------------------------------------------- */
async function shortTiny(url) {
  try {
    const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${url}`);
    return data; // TinyURL returns just the text string
  } catch {
    return null;
  }
}

/* -------------------------------------------------------
   API 2: Is.gd (Backup)
------------------------------------------------------- */
async function shortIsgd(url) {
  try {
    const { data } = await axios.get(`https://is.gd/create.php?format=json&url=${url}`);
    return data.shorturl;
  } catch {
    return null;
  }
}

export default {
  name: 'shorten',
  alias: ['short', 'bitly', 'link'],

  command: {
    pattern: 'shorten',
    desc: 'Compress long URLs into short links',
    category: 'tools',
    react: '🔗',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const url = args[0];

      // 1. Validate Input
      if (!url) {
        return await sock.sendMessage(chat, {
          text: '🔗 *Link Compressor*\n\nUsage: `.shorten <link>`\nExample: `.shorten https://google.com`'
        }, { quoted: msg });
      }

      // Basic URL check
      if (!url.startsWith('http')) {
        return await sock.sendMessage(chat, { text: '❌ Please provide a valid URL starting with http:// or https://' }, { quoted: msg });
      }

      // 2. React
      try { await sock.sendMessage(chat, { react: { text: '⏳', key: msg.key } }); } catch { }

      // 3. Waterfall Strategy
      let shortLink = null;
      let provider = '';

      // Try GiftedTech Providers
      const providers = ['tinyurl', 'cleanuri', 'vgd', 'rebrandly', 'vurl', 'adfoc', 'ssur'];

      for (const p of providers) {
        shortLink = await shortGifted(url, p);
        if (shortLink) {
          provider = p.charAt(0).toUpperCase() + p.slice(1);
          break;
        }
      }

      // Fallbacks
      if (!shortLink) {
        shortLink = await shortTiny(url);
        provider = 'TinyURL (Direct)';
      }
      if (!shortLink) {
        shortLink = await shortIsgd(url);
        provider = 'Is.gd';
      }

      if (!shortLink) {
        return await sock.sendMessage(chat, { text: '❌ Failed to shorten link. The URL might be invalid or blocked.' }, { quoted: msg });
      }

      // 4. Send Result
      const response =
        `🔗 *MIDKNIGHT COMPRESS*
────────────────
🔓 *Original:* ${url}
🔒 *Short:* ${shortLink}
────────────────`;

      await sock.sendMessage(chat, { text: response }, { quoted: msg });
      try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }
    }
  }
};