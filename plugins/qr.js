import axios from 'axios';

/* -------------------------------------------------------
   FALLBACK API LIST
------------------------------------------------------- */
/* -------------------------------------------------------
   FALLBACK API LIST
------------------------------------------------------- */
const PROVIDERS = [
  // 0. GiftedTech - Priority
  (text) => `https://api.giftedtech.co.ke/api/tools/createqr?apikey=gifted&query=${text}`,

  // 1. QRServer (GoQR) - Very reliable, allows high margins
  (text) => `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${text}&margin=25&ecc=H`,

  // 2. QuickChart - Excellent quality, Google Cloud backed
  (text) => `https://quickchart.io/qr?text=${text}&size=1024&margin=4&ecLevel=H&format=png`,

  // 3. Image-Charts - Enterprise grade, solid backup
  (text) => `https://image-charts.com/chart?chs=512x512&cht=qr&chl=${text}&choe=UTF-8`
];

/* -------------------------------------------------------
   GENERATOR LOGIC
------------------------------------------------------- */
async function generateQR(input) {
  const encoded = encodeURIComponent(input);

  for (const getUrl of PROVIDERS) {
    try {
      const url = getUrl(encoded);
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000 // 5s timeout per API
      });

      if (res.data && res.data.length > 100) { // Ensure it's a valid image data
        return Buffer.from(res.data);
      }
    } catch (e) {
      // console.warn(`QR provider failed: ${e.message}`); // For debugging fallback
      continue; // Try next API
    }
  }
  return null;
}

/* -------------------------------------------------------
   PLUGIN
------------------------------------------------------- */
export default {
  name: 'qr',
  alias: ['qrcode', '2d'],

  command: {
    pattern: 'qr',
    desc: 'Generate a QR code (Multi-API Fallback)',
    category: 'tools',
    react: '🔳',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      // 1. Determine Input (Args > Reply > Fail)
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;

      const input = args.length > 0 ? args.join(' ') : quotedText;

      if (!input) {
        return sock.sendMessage(chat, {
          text: '🔳 *Usage:*\n• Type: `.qr <text>`\n• Or reply to a message with `.qr`'
        }, { quoted: msg });
      }

      // 2. React
      try { await sock.sendMessage(chat, { react: { text: '⏳', key: msg.key } }); } catch { }

      // 3. Generate
      const buffer = await generateQR(input);

      if (!buffer) {
        return sock.sendMessage(chat, { text: '❌ Failed to generate QR. All APIs are unreachable.' }, { quoted: msg });
      }

      // 4. Send with updated caption
      await sock.sendMessage(chat, {
        image: buffer,
        caption: `╭━━━『 🔳 MIDKNIGHT QR 』━━━╮
┃
┃ 🔒 *Encoded:* ${input.length > 30 ? input.slice(0, 30) + '...' : input}
┃ 📏 *Size:* 1024x1024
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Scan to unlock.”_`
      }, { quoted: msg });

      try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }
    }
  }
};