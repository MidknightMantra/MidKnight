import axios from 'axios';

function delay(min = 100, max = 300) {
  return new Promise((r) =>
    setTimeout(r, Math.floor(min + Math.random() * (max - min)))
  );
}

/* ---------------------------------------------------------
   Supported Languages & Accents
--------------------------------------------------------- */
const LANGS = {
  'en': 'English (US)',
  'uk': 'English (UK)', // Added accent support
  'au': 'English (AU)', // Added accent support
  'ar': 'Arabic',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'hi': 'Hindi',
  'sw': 'Swahili',
  'id': 'Indonesian',
  'tr': 'Turkish'
};

// Map short codes to Google's internal codes
const CODE_MAP = {
  'uk': 'en-UK',
  'au': 'en-AU',
  'en': 'en-US'
};

/* ---------------------------------------------------------
   HELPER: Split long text into 200-char chunks
--------------------------------------------------------- */
function splitText(text, maxLength = 200) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + word).length < maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/* ---------------------------------------------------------
   Google TTS API (with Chunking)
--------------------------------------------------------- */
async function googleTTS(text, lang = 'en') {
  // Handle accents logic
  const googleLang = CODE_MAP[lang] || lang;

  // Split text if it's too long
  const parts = splitText(text);
  const buffers = [];

  try {
    for (const part of parts) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(part)}&tl=${googleLang}`;

      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        },
        timeout: 10000,
      });

      buffers.push(Buffer.from(res.data));

      // Tiny delay between chunks to be polite to Google
      await delay(100, 200);
    }

    // Combine all chunks into one audio file
    return Buffer.concat(buffers);

  } catch (err) {
    console.error('TTS Error:', err.message);
    return null;
  }
}

/* ---------------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------------- */
export default {
  name: 'tts',

  command: {
    pattern: 'tts',
    desc: 'Text to Speech (Unlimited length)',
    category: 'tools',
    react: '🗣️',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      // 1. React
      try { await sock.sendMessage(chat, { react: { text: '🗣️', key: msg.key } }); } catch { }

      // 2. Determine Text & Language
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || quotedMsg?.imageMessage?.caption;

      let lang = 'en';
      let text = '';

      // Scenario A: User typed ".tts ja Hello"
      if (args.length > 0 && LANGS[args[0].toLowerCase()]) {
        lang = args[0].toLowerCase();
        text = args.slice(1).join(' ');
      }
      // Scenario B: User typed ".tts Hello" (defaults to EN)
      else if (args.length > 0) {
        text = args.join(' ');
      }

      // Scenario C: User replied to a message
      if (!text && quotedText) {
        text = quotedText;
        // Check if they provided a lang in the command (e.g. replying with ".tts ja")
        if (args.length > 0 && LANGS[args[0].toLowerCase()]) {
          lang = args[0].toLowerCase();
        }
      }

      if (!text) {
        return sock.sendMessage(chat, {
          text: '🗣️ *Usage:*\n• `.tts <lang> <text>`\n• Reply to a message with `.tts <lang>`\n\n*Supported:* ' + Object.keys(LANGS).join(', ')
        }, { quoted: msg });
      }

      await delay();

      // 3. Fetch Audio
      const audio = await googleTTS(text, lang);

      if (!audio) {
        return sock.sendMessage(chat, { text: '❌ *TTS Error:* Text might be unsupported or API is busy.' }, { quoted: msg });
      }

      // 4. Send as Voice Note (PTT)

      return sock.sendMessage(
        chat,
        {
          audio: audio,
          mimetype: 'audio/mp4',
          ptt: true // This makes it a "green" voice note
        },
        { quoted: msg }
      );
    },
  },
};