import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { fileURLToPath } from 'url';

// Use system ffmpeg or fallback paths
const ffmpegPath = 'ffmpeg'; // System path

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP)) fs.mkdirSync(TEMP, { recursive: true });

/* -----------------------------------------------------------
   🛠️ HELPER: Robust Media Downloader
----------------------------------------------------------- */
async function downloadMedia(msg) {
  try {
    const type = Object.keys(msg)[0];
    const stream = await downloadContentFromMessage(msg[type], type.replace('Message', ''));
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  } catch (e) {
    return null;
  }
}

/* -----------------------------------------------------------
   🎞️ HELPER: FFmpeg Converter (The Engine)
----------------------------------------------------------- */
function ffmpeg(buffer, args = [], ext = '') {
  return new Promise((resolve, reject) => {
    const tmpIn = path.join(TEMP, `${Date.now()}_in.${ext}`);
    const tmpOut = path.join(TEMP, `${Date.now()}_out.webp`);

    fs.writeFileSync(tmpIn, buffer);

    // USE ffmpegPath INSTEAD OF JUST "ffmpeg"
    const cmd = `"${ffmpegPath}" -y -i "${tmpIn}" ${args.join(' ')} -f webp "${tmpOut}"`;

    exec(cmd, (err) => {
      if (err) {
        try { fs.unlinkSync(tmpIn); } catch { }
        reject(err);
      } else {
        const data = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); } catch { }
        resolve(data);
      }
    });
  });
}

export default {
  name: 'sticker',
  alias: ['s', 'steal'],

  command: {
    pattern: 'sticker',
    desc: 'Create stickers (Crop, Full, or Steal)',
    category: 'media',
    react: '🎨',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      try { await sock.sendMessage(chat, { react: { text: '🎨', key: msg.key } }); } catch { }

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const targetMsg = quoted || msg.message;

      const isImage = targetMsg.imageMessage;
      const isVideo = targetMsg.videoMessage;
      const isSticker = targetMsg.stickerMessage;

      if (!isImage && !isVideo && !isSticker) {
        return sock.sendMessage(chat, { text: '❌ Reply to an image, video, or sticker.' }, { quoted: msg });
      }

      const fullText = args.join(' ');
      const isFull = fullText.toLowerCase().includes('full') || fullText.toLowerCase().includes('nobg');

      // Midknight Branding Defaults
      let [pack, author] = fullText.replace(/full/i, '').split('|');
      pack = (pack || 'Midknight Art').trim();
      author = (author || 'Midknight Bot').trim();

      const mediaBuffer = await downloadMedia(targetMsg);
      if (!mediaBuffer) return sock.sendMessage(chat, { text: '❌ Failed to download media.' });

      try {
        let stickerBuffer;

        const cropFilter = 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,setsar=1';
        const fullFilter = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1';

        const filter = isFull ? fullFilter : cropFilter;

        if (isImage || isSticker) {
          stickerBuffer = await ffmpeg(
            mediaBuffer,
            [
              `-vf "${filter}"`,
              '-loop 0',
              '-ss 00:00:00.0',
              '-t 00:00:10.0',
              '-preset default',
              '-an',
              '-vsync 0',
              '-s 512x512'
            ],
            'jpg'
          );
        } else if (isVideo) {
          stickerBuffer = await ffmpeg(
            mediaBuffer,
            [
              `-vf "${filter}"`,
              '-loop 0',
              '-ss 00:00:00.0',
              '-t 00:00:08.0',
              '-preset default',
              '-an',
              '-vsync 0',
              '-s 512x512'
            ],
            'mp4'
          );
        }

        await sock.sendMessage(chat, {
          sticker: stickerBuffer,
          packname: pack,
          author: author
        }, { quoted: msg });

        try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

      } catch (err) {
        console.error(err);
        return sock.sendMessage(chat, { text: '❌ Conversion failed. Ensure the video is short.' }, { quoted: msg });
      }
    }
  }
};