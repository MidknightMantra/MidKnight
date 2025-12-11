import axios from 'axios';

/* ============================================================
   HELPER: Google TTS Generator (Audio Fallback)
   Generates a spoken audio URL if the dictionary has none.
============================================================ */
function getGoogleTTS(text) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
}

/* ============================================================
   API 1: DictionaryAPI (Standard English + Human Audio)
============================================================ */
async function defStandard(word) {
  try {
    const r = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      }
    );

    const d = r.data?.[0];
    if (!d) return null;

    const meaning = d.meanings?.[0];

    // AUDIO HUNT: Find the first valid audio link in the phonetics array
    let validAudio = null;
    if (d.phonetics && d.phonetics.length > 0) {
      const found = d.phonetics.find(p => p.audio && p.audio !== '');
      if (found) validAudio = found.audio;
    }

    return {
      source: 'Standard',
      word: d.word,
      phonetic: d.phonetic || '',
      part: meaning?.partOfSpeech || 'noun',
      definition: meaning?.definitions?.[0]?.definition || 'No definition found.',
      example: meaning?.definitions?.[0]?.example || null,
      synonyms: meaning?.synonyms?.slice(0, 5) || [],
      audio: validAudio // Can be null
    };
  } catch (e) {
    console.error('[Dictionary] Standard API failed:', e.message);
    return null;
  }
}

/* ============================================================
   API 2: Datamuse (The "Broad" Backup)
   Excellent for finding words that standard dictionaries miss.
============================================================ */
async function defDatamuse(word) {
  try {
    // md=d tells the API to return definitions (d)
    const r = await axios.get(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`,
      {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      }
    );

    const d = r.data?.[0];
    if (!d || !d.defs) return null;

    // Datamuse format is "n\tThe definition text". We need to split it.
    const rawDef = d.defs[0];
    const parts = rawDef.split('\t');
    const partOfSpeech = parts[0] === 'n' ? 'noun' : parts[0] === 'v' ? 'verb' : 'adj';
    const definition = parts.length > 1 ? parts[1] : parts[0];

    return {
      source: 'Datamuse',
      word: d.word,
      phonetic: '',
      part: partOfSpeech,
      definition: definition,
      example: null,
      synonyms: [], // Datamuse is separate for synonyms, keeping it light
      audio: null // Datamuse doesn't have audio, will force TTS
    };
  } catch (e) {
    console.error('[Dictionary] Datamuse API failed:', e.message);
    return null;
  }
}

/* ============================================================
   API 3: Urban Dictionary (The "Slang" Fallback)
============================================================ */
async function defUrban(word) {
  try {
    const r = await axios.get(
      `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`,
      {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      }
    );

    const d = r.data?.list?.[0];
    if (!d) return null;

    const clean = (t) => t.replace(/\[|\]/g, '');

    return {
      source: 'Urban',
      word: d.word,
      phonetic: 'Slang',
      part: 'informal',
      definition: clean(d.definition),
      example: clean(d.example),
      synonyms: [],
      audio: null // Will force TTS
    };
  } catch (e) {
    console.error('[Dictionary] Urban API failed:', e.message);
    return null;
  }
}

/* ============================================================
   MASTER CONTROLLER
============================================================ */
export default {
  name: 'dictionary',
  command: {
    pattern: 'define',
    desc: 'Search 3 dictionaries + Send Audio',
    category: 'tools',
    react: '📚',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      if (!args.length) {
        return sock.sendMessage(chat, {
          text: '📚 *Dictionary*\nUsage: `.define <word>`'
        }, { quoted: msg });
      }

      const word = args.join(' ').trim();

      // 1. UI Feedback
      try { await sock.sendMessage(chat, { react: { text: '🔍', key: msg.key } }); } catch { }

      // 2. The "Waterfall" Search
      let result = await defStandard(word); // Try Tier 1

      if (!result) {
        result = await defDatamuse(word); // Try Tier 2
      }

      if (!result) {
        result = await defUrban(word); // Try Tier 3
      }

      // 3. If all fail
      if (!result) {
        try { await sock.sendMessage(chat, { react: { text: '❌', key: msg.key } }); } catch { }
        return sock.sendMessage(chat, { text: `❌ The word *"${word}"* is lost to the void.` }, { quoted: msg });
      }

      // 4. Prepare Output Text
      const headerIcon = result.source === 'Urban' ? '🏙️' : result.source === 'Datamuse' ? '🧠' : '📘';
      let text = `${headerIcon} *${result.word}*`;

      if (result.phonetic) text += ` /${result.phonetic}/`;
      text += `\n\n📝 *${result.part}*`;
      text += `\n📖 ${result.definition}`;

      if (result.example) {
        text += `\n\n💡 _"${result.example}"_`;
      }

      if (result.synonyms.length > 0) {
        text += `\n🔗 *Syns:* ${result.synonyms.join(', ')}`;
      }

      // 5. Determine Audio Source (Real or Artificial)
      let finalAudioUrl = result.audio;
      let isTTS = false;

      if (!finalAudioUrl) {
        finalAudioUrl = getGoogleTTS(result.word);
        isTTS = true;
      }

      // 6. Send Everything
      // We send the text first
      await sock.sendMessage(chat, { text: text }, { quoted: msg });

      // Then we send the audio (Voice Note)
      // Note: We wrap in try/catch because sometimes audio URLs expire or block bot requests
      try {
        await sock.sendMessage(chat, {
          audio: { url: finalAudioUrl },
          mimetype: 'audio/mp4',
          ptt: true // ptt: true makes it appear as a voice note waveform
        }, { quoted: msg });
      } catch (err) {
        console.log('Audio failed to send:', err);
        // If sending audio fails, we don't error out, just ignore it.
      }
    },
  },
};