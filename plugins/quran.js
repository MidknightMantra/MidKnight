import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { delay } from '../src/utils/common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(__dirname, '../session/config');
const CACHE_PATH = path.join(CONFIG_DIR, 'quran_cache.json');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
} catch {
  cache = {};
}

function saveCache() {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/* ---------------------------------------------------------
   Parse references:
   2:255
   112:1-4
   surah ikhlas
   search mercy
--------------------------------------------------------- */
function parseReference(str) {
  str = str.toLowerCase().trim();

  if (!str) return null;
  if (str.startsWith('search ')) return { search: str.replace('search', '').trim() };
  if (str.startsWith('surah ')) return { surahName: str.replace('surah', '').trim() };

  if (/^\d+:\d+(-\d+)?$/.test(str)) {
    const [s, a] = str.split(':');
    if (a.includes('-')) {
      const [from, to] = a.split('-');
      return { surah: +s, from: +from, to: +to };
    }
    return { surah: +s, from: +a, to: +a };
  }

  const parts = str.split(/\s+/);
  if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    return { surah: +parts[0], from: +parts[1], to: +parts[1] };
  }

  return null;
}

/* ---------------------------------------------------------
   API #1 — api.alquran.cloud (Arabic + English)
--------------------------------------------------------- */
async function fetchAlQuranCloud(ref) {
  try {
    const { surah, from, to, surahName, search } = ref;

    // SEARCH MODE
    if (search) {
      const url = `https://api.alquran.cloud/v1/search/${encodeURIComponent(search)}/all/en`;
      const r = await axios.get(url);

      const matches = r.data?.data?.matches;
      if (!matches?.length) return null;

      return {
        ok: true,
        source: 'alquran.cloud-search',
        text:
          '🔎 *Quran Search Results*\n\n' +
          matches
            .slice(0, 10)
            .map(
              (m) => `(${m.surah.number}:${m.numberInSurah}) — ${m.text}`
            )
            .join('\n')
      };
    }

    // SURAH BY NAME
    if (surahName) {
      const url = `https://api.alquran.cloud/v1/surah/${surahName}/ar.alafasy`;
      const r = await axios.get(url);
      if (!r.data?.data) return null;

      const data = r.data.data;
      const verses = data.ayahs.map(
        (a) => `*${a.numberInSurah}.* ${a.text}`
      );

      return {
        ok: true,
        source: 'alquran.cloud',
        text:
          `📖 *Surah ${data.englishName}* (${data.number})\n` +
          '━━━━━━━━━━━━━━━━━━\n' +
          verses.join('\n')
      };
    }

    // BY SURAH NUMBER
    const arURL = `https://api.alquran.cloud/v1/surah/${surah}/ar.alafasy`;
    const enURL = `https://api.alquran.cloud/v1/surah/${surah}/en.asad`;

    const [arRes, enRes] = await Promise.all([
      axios.get(arURL),
      axios.get(enURL),
    ]);

    const ar = arRes.data?.data;
    const en = enRes.data?.data;

    if (!ar?.ayahs || !en?.ayahs) return null;

    const out = [];
    for (let i = from; i <= to; i++) {
      const a = ar.ayahs.find((x) => x.numberInSurah === i);
      const e = en.ayahs.find((x) => x.numberInSurah === i);

      if (a && e) {
        out.push(
          `*${i}.*\n` +
          `﴿ ${a.text} ﴾\n` +
          `*${e.text}*\n`
        );
      }
    }

    return {
      ok: true,
      store: 'alquran.cloud',
      text:
        `📖 *Surah ${ar.englishName}* (${surah})\n` +
        `Ayah ${from}${to !== from ? `-${to}` : ''}\n` +
        '━━━━━━━━━━━━━━━━━━\n' +
        out.join('\n')
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------
   API #2 — Ainosi Quran API (Arabic only)
--------------------------------------------------------- */
async function fetchAinosi(ref) {
  try {
    const { surah, from, to, surahName } = ref;
    if (surahName) return null;

    const r = await axios.get(`https://quran-api.ainosi.workers.dev/surah/${surah}`);
    if (!r.data?.ayahs) return null;

    const out = r.data.ayahs
      .filter((v) => v.number >= from && v.number <= to)
      .map(
        (v) =>
          `*${v.number}.*\n﴿ ${v.arab} ﴾\n_${v.translation}_\n`
      );

    return {
      ok: true,
      source: 'ainosi',
      text:
        `📖 Surah ${surah}\nAyah ${from}${to !== from ? `-${to}` : ''}\n` +
        '━━━━━━━━━━━━━━━━━━\n' +
        out.join('\n')
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------
   API #3 — QuranEnc (English translation only)
--------------------------------------------------------- */
async function fetchQuranEnc(ref) {
  try {
    const { surah, from, to } = ref;

    const r = await axios.get(
      `https://quranenc.com/api/v1/translation/english_saheeh/${surah}`
    );

    if (!r.data?.result) return null;

    const out = r.data.result
      .filter((x) => x.verse_id >= from && x.verse_id <= to)
      .map(
        (v) => `*${v.verse_id}.* ${v.translation}`
      );

    return {
      ok: true,
      source: 'quranenc',
      text:
        `📖 Surah ${surah} — English Translation\n` +
        '━━━━━━━━━━━━━━━━━━\n' +
        out.join('\n')
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------
   MASTER FALLBACK
--------------------------------------------------------- */
async function lookupQuran(ref, raw) {
  raw = raw.toLowerCase();
  if (cache[raw]) return { ...cache[raw], cached: true };

  const apis = [fetchAlQuranCloud, fetchAinosi, fetchQuranEnc];

  for (const api of apis) {
    const out = await api(ref);
    if (out?.ok) {
      cache[raw] = out;
      saveCache();
      return out;
    }
    await delay();
  }

  return null;
}

/* ---------------------------------------------------------
   Long message splitter
--------------------------------------------------------- */
function splitLong(text, max = 3800) {
  const out = [];
  while (text.length > max) {
    out.push(text.slice(0, max));
    text = text.slice(max);
  }
  out.push(text);
  return out;
}

/* ---------------------------------------------------------
   EXPORT PLUGIN
--------------------------------------------------------- */
export default {
  name: 'quran',

  command: {
    pattern: 'quran',
    desc: 'Fetch Quran verses (Arabic + English)',
    category: 'tools',
    react: '☪️',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const raw = args.join(' ').trim();

      if (!raw) {
        return sock.sendMessage(chat, {
          text:
            '☪️ *Usage:*\n' +
            '• .quran 2:255\n' +
            '• .quran 112:1-4\n' +
            '• .quran surah ikhlas\n' +
            '• .quran search mercy'
        });
      }

      // react
      try {
        await sock.sendMessage(chat, {
          react: { text: '☪️', key: msg.key },
        });
      } catch { }

      const ref = parseReference(raw);
      if (!ref)
        return sock.sendMessage(chat, {
          text: `❌ Invalid reference: *${raw}*`,
        });

      const result = await lookupQuran(ref, raw);
      if (!result)
        return sock.sendMessage(chat, {
          text: `❌ No verses found for: *${raw}*`,
        });

      const text = result.text;

      // If very long, send as .txt file
      if (text.length > 6000) {
        const tmp = path.join(os.tmpdir(), `quran_${Date.now()}.txt`);
        fs.writeFileSync(tmp, text);
        return sock.sendMessage(
          chat,
          {
            document: fs.readFileSync(tmp),
            mimetype: 'text/plain',
            fileName: `${raw.replace(/\W+/g, '_')}.txt`,
          },
          { quoted: msg }
        );
      }

      // Split & send
      for (const part of splitLong(text)) {
        await sock.sendMessage(
          chat,
          { text: part },
          { quoted: msg }
        );
      }
    },
  },
};
