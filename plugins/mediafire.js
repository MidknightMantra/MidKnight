import axios from 'axios';
import * as cheerio from 'cheerio';
import mime from 'mime-types';
import { delay } from '../src/utils/common.js';

/* ---------------------------------------------------
   HELPER: Parse File Size
   Converts "15.4 MB" strings into a Number for logic
--------------------------------------------------- */
function parseFileSize(sizeStr) {
  const match = sizeStr.match(/([\d.]+)\s*([a-zA-Z]+)/);
  if (!match) return 0;

  let size = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (unit.includes('GB')) size *= 1024; // Convert to MB
  if (unit.includes('KB')) size /= 1024; // Convert to MB

  return size; // Returns size in MB
}

/* ---------------------------------------------------
   ENGINE 0: GIFTED TECH (Priority)
--------------------------------------------------- */
async function mediafireGifted(url) {
  try {
    const { data } = await axios.get(`https://api.giftedtech.co.ke/api/download/mediafiredl?apikey=gifted&url=${encodeURIComponent(url)}`);
    const res = data.result || data;

    if (res && (res.url || res.download_url || res.link)) {
      return {
        filename: res.filename || res.name || 'Unknown_File',
        sizeStr: res.filesize || res.size || 'Unknown',
        sizeMB: parseFileSize(res.filesize || res.size || '0 MB'),
        url: res.url || res.download_url || res.link,
        ext: (res.filename || res.name || '').split('.').pop() || 'unknown'
      };
    }
  } catch (e) {
    // console.log("GiftedTech MediaFire Failed");
  }
  return null;
}

/* ---------------------------------------------------
   EXTRACTOR (Scraper Fallback)
--------------------------------------------------- */
async function mediafireDownload(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);

    // 1. Try standard download button
    let dl = $('#downloadButton').attr('href');

    // 2. Fallback for different layouts
    if (!dl) {
      dl = $('a[aria-label=\'Download file\']').attr('href');
    }

    if (!dl) return null;

    // Extract Metadata
    let name = $('.filename').text().trim();
    let sizeText = $('.filesize').text().trim(); // e.g. "34.5 MB"

    // Cleanup Name (MediaFire often adds unnecessary whitespace)
    if (!name) name = $('div.dl-btn-label').text().trim();
    name = name.replace(/\s+/g, ' ');

    // Cleanup Size
    if (!sizeText) {
      const s = $('div.dl-info').text();
      const m = s.match(/\((.*?)\)/);
      sizeText = m ? m[1] : 'Unknown';
    }

    return {
      filename: name || 'Unknown_File',
      sizeStr: sizeText,
      sizeMB: parseFileSize(sizeText),
      url: dl,
      ext: name.split('.').pop()
    };
  } catch (err) {
    console.error('MEDIAFIRE ERROR:', err.message);
    return null;
  }
}

export default {
  name: 'mediafire',

  command: {
    pattern: 'mediafire',
    desc: 'Download files from MediaFire (Auto-upload < 100MB)',
    category: 'tools',
    react: '📦',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const url = args[0];

      if (!url || !url.includes('mediafire.com')) {
        return sock.sendMessage(chat, { text: '📦 *Usage:* .mediafire <link>' }, { quoted: msg });
      }

      // 1. Feedback
      await sock.sendPresenceUpdate('composing', chat);
      try { await sock.sendMessage(chat, { react: { text: '🔎', key: msg.key } }); } catch { }

      // 2. Execute Waterfall
      let data = await mediafireGifted(url);

      if (!data) {
        // Fallback to scraper
        data = await mediafireDownload(url);
      }

      if (!data) {
        return sock.sendMessage(chat, { text: '❌ *Failed to fetch file.* The link might be dead or protected.' }, { quoted: msg });
      }



      // 3. Send Info Text First
      const caption = '📦 *MediaFire Download*\n\n' +
        `📄 *File:* ${data.filename}\n` +
        `📊 *Size:* ${data.sizeStr}\n` +
        `🔗 *Direct Link:* ${data.url}`;

      await sock.sendMessage(chat, { text: caption }, { quoted: msg });

      // 4. LOGIC: Should we upload the file?
      // WhatsApp bots usually struggle with files > 100MB.
      const LIMIT_MB = 100;

      if (data.sizeMB > LIMIT_MB) {
        return sock.sendMessage(chat, {
          text: `⚠️ *File is too large (${data.sizeStr})* to upload directly to WhatsApp.\nPlease use the direct link above.`
        }, { quoted: msg });
      }

      // 5. Upload File
      try {
        await sock.sendMessage(chat, { react: { text: '⬆️', key: msg.key } });

        // Get correct mimetype
        const mimetype = mime.lookup(data.ext) || 'application/octet-stream';

        await sock.sendMessage(chat, {
          document: { url: data.url },
          mimetype: mimetype,
          fileName: data.filename
        }, { quoted: msg });

        await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } });

      } catch (err) {
        console.log('Upload failed:', err);
        await sock.sendMessage(chat, { text: '❌ *Upload failed* (Connection lost or link expired). Please use the link above.' }, { quoted: msg });
      }
    }
  }
};