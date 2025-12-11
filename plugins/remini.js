import axios from 'axios';
import FormData from 'form-data';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

/* -------------------------------------------------------
   HELPER: Upload to Telegra.ph
   (We need a URL because the AI APIs don't accept raw files)
------------------------------------------------------- */
async function uploadToTelegraph(buffer) {
  try {
    const form = new FormData();
    form.append('file', buffer, { filename: 'image.jpg' });

    const { data } = await axios.post('https://telegra.ph/upload', form, {
      headers: form.getHeaders(),
    });

    if (data && data[0] && data[0].src) {
      return 'https://telegra.ph' + data[0].src;
    }
  } catch (e) {
    console.error('Upload failed:', e.message);
  }
  return null;
}

/* -------------------------------------------------------
   API WATERFALL: The "Enhance" Engine
------------------------------------------------------- */
/* -------------------------------------------------------
   API WATERFALL: The "Enhance" Engine
------------------------------------------------------- */
async function enhanceImage(url) {
  // API 0: GiftedTech (Priority)
  try {
    const { data } = await axios.get(`https://api.giftedtech.co.ke/api/tools/remini?apikey=gifted&url=${url}`);
    if (data.result || data.url) return data.result || data.url;
  } catch { }

  // API 1: Dark Yasiya (Backup)
  try {
    const { data } = await axios.get(`https://dark-yasiya-api-new.vercel.app/ai/remini?url=${url}`);
    if (data.result) return data.result;
  } catch { }

  // API 2: BK9 (Backup)
  try {
    const { data } = await axios.get(`https://bk9.fun/ai/remini?url=${url}`);
    if (data.BK9) return data.BK9;
  } catch { }

  // API 3: Skizo (Emergency Backup)
  try {
    const { data } = await axios.get(`https://skizo.tech/api/remini?url=${url}&apikey=free`);
    if (data.url) return data.url;
  } catch { }

  return null;
}

/* -------------------------------------------------------
   PLUGIN: Remini
------------------------------------------------------- */
export default {
  name: 'remini',
  alias: ['hd', 'enhance', 'upscale', 'clarify'],

  command: {
    pattern: 'remini',
    desc: 'Enhance blurry images to HD quality',
    category: 'media',
    react: '✨',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      // 1. Check if user replied to an image
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const mime = quoted?.imageMessage?.mimetype || '';

      if (!quoted || !mime.includes('image')) {
        return await sock.sendMessage(chat, {
          text: '✨ *Remini Enhancer*\n\nReply to a blurry photo with `.remini` to enhance it.'
        }, { quoted: msg });
      }

      // 2. React & Notify
      try { await sock.sendMessage(chat, { react: { text: '⏳', key: msg.key } }); } catch { }
      const loadingMsg = await sock.sendMessage(chat, { text: '✨ *Midknight is enhancing visual data...*' }, { quoted: msg });

      try {
        // 3. Download the Image
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        // 4. Upload to get URL
        const url = await uploadToTelegraph(buffer);
        if (!url) {
          await sock.sendMessage(chat, { text: '❌ Failed to upload image to processing server.' }, { quoted: msg });
          return;
        }

        // 5. Process via AI
        const hdUrl = await enhanceImage(url);

        if (!hdUrl) {
          await sock.sendMessage(chat, { text: '❌ Enhancement failed. The image might be too large or complex.' }, { quoted: msg });
          return;
        }

        // 6. Send Result
        await sock.sendMessage(chat, {
          image: { url: hdUrl },
          caption: `╭━━━『 ✨ MIDKNIGHT REMINI 』━━━╮
┃
┃ 🖼️ *Status:* Enhanced
┃ 🔍 *Quality:* HD
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Clarity restored.”_`
        }, { quoted: msg });

        // Cleanup
        try { await sock.sendMessage(chat, { delete: loadingMsg.key }); } catch { }
        try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

      } catch (error) {
        console.error('Remini Error:', error);
        await sock.sendMessage(chat, { text: '❌ System Error during enhancement.' }, { quoted: msg });
      }
    }
  }
};