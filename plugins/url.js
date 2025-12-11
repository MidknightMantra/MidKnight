import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -----------------------------------------------------------
   Anti-ban delay
----------------------------------------------------------- */
function delay(min = 150, max = 450) {
  return new Promise((r) =>
    setTimeout(r, Math.floor(min + Math.random() * (max - min)))
  );
}

/* -----------------------------------------------------------
   MULTIPLE UPLOAD APIS WITH FALLBACKS
----------------------------------------------------------- */
async function uploadToGifted(filePath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const { data } = await axios.post('https://api.giftedtech.co.ke/upload/', form, {
      headers: { ...form.getHeaders() },
      timeout: 30000
    });

    return data.result || data.url || data.file || null;
  } catch (e) {
    console.error('Gifted Upload Error:', e.message);
    return null;
  }
}

async function uploadToCatbox(filePath) {
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fs.createReadStream(filePath));

    const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: { ...form.getHeaders() },
      timeout: 30000
    });

    // Catbox returns just the URL as text
    return typeof data === 'string' && data.startsWith('http') ? data.trim() : null;
  } catch (e) {
    console.error('Catbox Upload Error:', e.message);
    return null;
  }
}

async function uploadToPomf(filePath) {
  try {
    const form = new FormData();
    form.append('files[]', fs.createReadStream(filePath));

    const { data } = await axios.post('https://pomf.lain.la/upload.php', form, {
      headers: { ...form.getHeaders() },
      timeout: 30000
    });

    return data.files?.[0]?.url ? `https://pomf.lain.la${data.files[0].url}` : null;
  } catch (e) {
    console.error('Pomf Upload Error:', e.message);
    return null;
  }
}

async function uploadToX0(filePath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const { data } = await axios.post('https://x0.at/', form, {
      headers: { ...form.getHeaders() },
      timeout: 30000
    });

    // x0.at returns just the URL as text
    return typeof data === 'string' && data.startsWith('http') ? data.trim() : null;
  } catch (e) {
    console.error('x0.at Upload Error:', e.message);
    return null;
  }
}

// Smart upload with multiple PERMANENT API fallbacks
async function smartUpload(filePath) {
  // All these services keep files permanently
  let url = await uploadToGifted(filePath);
  if (url) return url;

  url = await uploadTo0x0(filePath);
  if (url) return url;

  url = await uploadToCatbox(filePath);
  if (url) return url;

  url = await uploadToPomf(filePath);
  if (url) return url;

  url = await uploadToX0(filePath);
  if (url) return url;

  return null;
}

/* -----------------------------------------------------------
   MEDIA EXTRACTOR
----------------------------------------------------------- */
async function extract(typeMsg, type) {
  const stream = await downloadContentFromMessage(typeMsg, type);
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

async function resolveMedia(message) {
  const m = message?.message || {};

  if (m.imageMessage)
    return { buffer: await extract(m.imageMessage, 'image'), ext: '.jpg' };

  if (m.videoMessage)
    return { buffer: await extract(m.videoMessage, 'video'), ext: '.mp4' };

  if (m.audioMessage)
    return { buffer: await extract(m.audioMessage, 'audio'), ext: '.mp3' };

  if (m.stickerMessage)
    return { buffer: await extract(m.stickerMessage, 'sticker'), ext: '.webp' };

  if (m.documentMessage) {
    const ext = path.extname(m.documentMessage.fileName || '') || '.bin';
    return { buffer: await extract(m.documentMessage, 'document'), ext };
  }

  return null;
}

async function resolveQuoted(message) {
  const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return null;
  return resolveMedia({ message: quoted });
}

/* -----------------------------------------------------------
   MAIN URL CONVERTER
----------------------------------------------------------- */
export default {
  name: 'url',
  alias: ['tourl', 'upload', 'link'],

  command: {
    pattern: 'url',
    desc: 'Convert any media into a shareable direct URL',
    category: 'tools',
    react: '🔗',

    run: async ({ sock, msg }) => {
      const chat = msg.key.remoteJid;

      try {
        // React to command
        try {
          await sock.sendMessage(chat, { react: { text: '🔗', key: msg.key } });
        } catch { }

        await delay();

        /* Extract media: prefer direct > quoted */
        let media;
        try {
          media = await resolveMedia(msg);
          if (!media) media = await resolveQuoted(msg);
        } catch (e) {
          console.error('Media extraction error:', e);
          return sock.sendMessage(chat, {
            text: `❌ Failed to extract media: ${e.message}`
          }, { quoted: msg });
        }

        if (!media) {
          return sock.sendMessage(
            chat,
            {
              text: '🔗 *Usage:* Reply to an image, video, or audio with `.url` to generate a link.'
            },
            { quoted: msg }
          );
        }

        await sock.sendMessage(chat, { text: '🔗 *Midknight is uploading to the cloud...*' }, { quoted: msg });

        /* Save temp file */
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const tempFile = path.join(tempDir, `${Date.now()}${media.ext}`);
        fs.writeFileSync(tempFile, media.buffer);

        /* Upload */
        let url;
        try {
          url = await smartUpload(tempFile);
        } catch (e) {
          console.error('Upload error:', e);
          // Cleanup on error
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          return sock.sendMessage(chat, {
            text: `❌ Upload failed: ${e.message}`
          }, { quoted: msg });
        }

        // Cleanup
        setTimeout(() => {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }, 1500);

        if (!url) {
          return sock.sendMessage(
            chat,
            { text: '❌ Upload failed. Server returned no URL.' },
            { quoted: msg }
          );
        }

        return sock.sendMessage(
          chat,
          {
            text: `╭━━━『 🔗 MIDKNIGHT CLOUD 』━━━╮
┃
┃ 🌐 *URL:* ${url}
┃ 💾 *Size:* ${(media.buffer.length / 1024 / 1024).toFixed(2)} MB
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Shared with the world.”_`
          },
          { quoted: msg }
        );
      } catch (e) {
        console.error('URL command error:', e);
        return sock.sendMessage(chat, {
          text: `❌ Unexpected error: ${e.message}`
        }, { quoted: msg });
      }
    },
  },
};
