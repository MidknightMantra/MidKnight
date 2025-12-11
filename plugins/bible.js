import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { delay } from '../src/utils/common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(__dirname, '../session/config'); // Adjusted path to be consistent with others
const CACHE_PATH = path.join(CONFIG_DIR, 'bible_cache.json');
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

// tiny cache: { query: { timestamp, source, text } }
let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8') || '{}');
} catch {
  cache = {};
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) { }
}

function normalizeReference(raw) {
  if (!raw) return null;
  raw = raw.trim();

  // Common cleanup: replace multiple spaces, allow no-space e.g. "john3:16"
  raw = raw.replace(/\s+/g, ' ');
  // Add space between letters and digits in some cases: "john3:16" -> "john 3:16"
  raw = raw.replace(/([a-zA-Z])(\d)/g, '$1 $2');

  // remove leading dot or prefix
  raw = raw.replace(/^\.+/, '');
  return raw;
}

function formatOutput(sourceName, ref, versesArr, metadata = {}) {
  const header = `📖 Midknight — Scripture\nReference: ${ref}\n\n`;
  const body = versesArr.map(v => {
    // some APIs supply verse.number and verse.text; others supply plain text
    if (v.verse || v.verseNumber || v.verse_num || v.number) {
      const num = v.verse || v.verseNumber || v.verse_num || v.number;
      const text = v.text || v.verse_text || v.content || v;
      return `${num}. ${String(text).trim()}`;
    }
    // if v is plain text line
    return String(v).trim();
  }).join('\n');

  let footer = '';
  if (metadata.version) footer += `\n\nVersion: ${metadata.version}`;
  if (metadata.generatedBy) footer += `\nGeneratedBy: ${metadata.generatedBy}`;
  return header + body + footer;
}

async function fetchBibleAPI(ref) {
  // bible-api.com -> https://bible-api.com/{ref}
  try {
    const url = `https://bible-api.com/${encodeURIComponent(ref)}`;
    const r = await axios.get(url, { timeout: 10000 });
    if (r?.data) {
      // r.data has .verses (array), .text, .reference
      const verses = r.data.verses?.map(v => ({ verse: v.verse, text: v.text })) || [];
      return {
        ok: true,
        source: 'bible-api.com',
        ref: r.data.reference || ref,
        verses,
        raw: r.data
      };
    }
  } catch (e) {
    // ignore and return null
  }
  return null;
}

async function fetchLabsBible(ref) {
  // labs.bible.org -> https://labs.bible.org/api/?passage=John%203:16&type=json
  try {
    const url = `https://labs.bible.org/api/?passage=${encodeURIComponent(ref)}&type=json`;
    const r = await axios.get(url, { timeout: 10000 });
    if (Array.isArray(r?.data) && r.data.length) {
      // r.data is array of {bookname, chapter, verse, text}
      const verses = r.data.map(v => ({ verse: v.verse, text: v.text }));
      const refOut = `${r.data[0].bookname} ${r.data[0].chapter}`;
      return {
        ok: true,
        source: 'labs.bible.org',
        ref: refOut,
        verses,
        raw: r.data
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function lookupReference(ref) {
  const q = ref.toLowerCase();

  // cache check (freshness)
  const cached = cache[q];
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return { fromCache: true, ...cached };
  }

  // Tier 1: bible-api.com
  const tryApis = [fetchBibleAPI, fetchLabsBible];

  for (const fn of tryApis) {
    try {
      const res = await fn(ref);
      if (res && res.ok) {
        const text = formatOutput(res.source, res.ref, res.verses, { version: res.raw?.version || undefined });
        cache[q] = { timestamp: Date.now(), source: res.source, text, ref: res.ref };
        saveCache();
        return { fromCache: false, source: res.source, text, ref: res.ref };
      }
    } catch (e) {
      // continue to next
    }
    // small delay between providers
    await delay(150);
  }

  // nothing found
  return null;
}

function splitMessageIfNeeded(text, max = 4000) {
  if (text.length <= max) return [text];
  const parts = [];
  let remain = text;
  while (remain.length > 0) {
    parts.push(remain.slice(0, max));
    remain = remain.slice(max);
  }
  return parts;
}

/* =========================================================
   Command Export
   Usage:
     .bible John 3:16
     .bible john3:16-18
     .bible psalm 23
========================================================= */
export default {
  name: 'bible',

  command: {
    pattern: 'bible',
    desc: 'Fetch scripture. Usage: .bible <reference>  (e.g. John 3:16-18, Psalm 23)',
    category: 'tools',
    react: '📖',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const rawRef = args.join(' ').trim();
      if (!rawRef) {
        return sock.sendMessage(chat, {
          text: '📖 Usage: .bible <reference>\nExamples:\n• .bible John 3:16\n• .bible John 3:16-18\n• .bible Psalm 23'
        });
      }

      const ref = normalizeReference(rawRef);

      // quick ack reaction (if supported)
      try {
        await sock.sendMessage(chat, { react: { text: '📖', key: msg.key } });
      } catch { }

      // lookup (cache-aware)
      const res = await lookupReference(ref);
      if (!res) {
        return sock.sendMessage(chat, { text: `❌ Could not find passage for *${ref}*.` }, { quoted: msg });
      }

      // if huge, write to file and send as document
      if (res.text.length > 6000) {
        try {
          const tmpDir = path.join(os.tmpdir(), 'midknight_bible');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          const fname = `bible-${ref.replace(/[/\\:?*"<>|]/g, '_')}.txt`;
          const full = path.join(tmpDir, fname);
          fs.writeFileSync(full, res.text, 'utf8');

          const stream = fs.readFileSync(full);
          return sock.sendMessage(chat, { document: stream, fileName: fname, mimetype: 'text/plain' }, { quoted: msg });
        } catch (e) {
          // fallback to chunked text
        }
      }

      const parts = splitMessageIfNeeded(res.text, 3800);
      for (const p of parts) {
        try {
          await sock.sendMessage(chat, { text: p }, { quoted: msg });
        } catch (e) {
          // best-effort: ignore
        }
      }
    }
  }
};
