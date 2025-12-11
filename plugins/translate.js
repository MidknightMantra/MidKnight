import axios from 'axios';

function delay(min = 150, max = 350) {
  return new Promise(res =>
    setTimeout(res, Math.floor(min + Math.random() * (max - min)))
  );
}

/* -------------------------------------------------------------
   Expanded Language Map
------------------------------------------------------------- */
const LANG_NAMES = {
  'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
  'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
  'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
  'sw': 'Swahili', 'id': 'Indonesian', 'tr': 'Turkish', 'nl': 'Dutch',
  'pl': 'Polish', 'vi': 'Vietnamese', 'th': 'Thai', 'uk': 'Ukrainian'
};

/* -------------------------------------------------------------
   1) Google Translate (GTX)
------------------------------------------------------------- */
async function translateGoogle(text, target) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    return r.data?.[0]?.map((a) => a[0]).join('') || null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------
   2) Lingva (Robust Google Wrapper)
------------------------------------------------------------- */
async function translateLingva(text, target) {
  try {
    // Lingva instances allow anonymous usage without rate limits
    const url = `https://lingva.ml/api/v1/auto/${target}/${encodeURIComponent(text)}`;
    const r = await axios.get(url, { timeout: 10000 });
    return r.data?.translation || null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------
   3) MyMemory API (Daily Limits)
------------------------------------------------------------- */
async function translateMyMemory(text, target) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`;
    const r = await axios.get(url, { timeout: 8000 });
    return r.data?.responseData?.translatedText || null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------
   MASTER FALLBACK CHAIN
------------------------------------------------------------- */
async function translate(text, target) {
  const chain = [translateGoogle, translateLingva, translateMyMemory];

  for (const api of chain) {
    try {
      const result = await api(text, target);
      if (result) return result;
    } catch { }
  }
  return null;
}

/* -------------------------------------------------------------
   PLUGIN EXPORT
------------------------------------------------------------- */
export default {
  name: 'translate',
  alias: ['trt', 'tr'],

  command: {
    pattern: 'translate',
    desc: 'Translate text (supports replies & auto-English)',
    category: 'tools',
    react: '🌐',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      // 1. React
      try { await sock.sendMessage(chat, { react: { text: '🌐', key: msg.key } }); } catch { }
      await delay();

      // 2. Get Quoted Text
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || quotedMsg?.imageMessage?.caption || null;

      let targetLang = 'en'; // Default to English
      let textToTranslate = '';

      // --- LOGIC: Determine Text and Target ---

      // CASE 1: Reply + No Args (.trt) -> Default to English
      if (quotedText && args.length === 0) {
        textToTranslate = quotedText;
        targetLang = 'en';
      }
      // CASE 2: Reply + Lang Arg (.trt es)
      else if (quotedText && args.length === 1) {
        textToTranslate = quotedText;
        targetLang = args[0];
      }
      // CASE 3: Direct Text (.trt es Hello World)
      else if (args.length >= 2) {
        targetLang = args[0];
        textToTranslate = args.slice(1).join(' ');
      }
      // ERROR
      else {
        return sock.sendMessage(chat, {
          text: '🌐 *Usage Error*\n\nTo translate a reply:\n👉 _.trt_ (defaults to English)\n👉 _.trt es_ (to Spanish)\n\nTo translate text:\n👉 _.trt fr Hello World_'
        }, { quoted: msg });
      }

      // Cleanup language code
      targetLang = targetLang.toLowerCase();

      // 3. Execute Translation
      const translation = await translate(textToTranslate, targetLang);

      if (!translation) {
        return sock.sendMessage(chat, { text: '❌ Translation failed. APIs are unreachable.' }, { quoted: msg });
      }

      // 4. Format Output
      const langName = LANG_NAMES[targetLang] || targetLang.toUpperCase();

      const reply =
        `🌐 *Translate ➜ ${langName}*\n` +
        '────────────────\n' +
        `📝 *Original:*\n${textToTranslate}\n\n` +
        `✨ *Result:*\n${translation}`;

      return sock.sendMessage(chat, { text: reply }, { quoted: msg });
    },
  },
};