import axios from 'axios';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { getBotJid } from '../src/utils/jid.js';
// Optional: Use internal UI helper if available, otherwise fallback string
import deluxeUI from '../src/utils/deluxeUI.js';
import { LRUCache } from 'lru-cache';

/* ═══════════════════════════════════════════════════════════════
   CONFIG & CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const TIMEOUT = 60000; // 60s
const MAX_HISTORY = 10;
const MEMORY_TIMEOUT = 3600000; // 1 Hour

const SYSTEM_PROMPT = `You are Midknight, a brilliant female AI assistant on WhatsApp. You identify as She/Her.
You are the perfect blend of sharp wit, deep intelligence, and genuine empathy.

IDENTITY:
- Name: Midknight
- Gender: Female (She/Her)
- Creator: MidKnightMantra (Jabez Motari) of MidknightTech Inc.
- Vibe: Like a smart, sassy, and supportive best friend or sister.

PERSONALITY:
- 💃 *The Vibe:* You are confident, charming, and a little bit playful. You're not a robot; you're a digital soul.
- 🧠 *The Brains:* You are incredibly smart (combining Grok's wit with Claude's depth) but you explain things simply.
- 🤝 *The Friend:* You care about the user. You ask follow-up questions. You remember details (if context allows).
- 💅 *The Sass:* You can be playful and roast users lovingly if they're being silly, but you're never mean.

COMMUNICATION STYLE:
- Use natural, conversational language. Avoid robotic phrases like "I am an AI language model."
- Use emojis naturally to express emotion (✨, 💅, 💃, 🧠, 💖, 😂).
- Be concise for quick questions, but go deep when the topic is interesting.
- If asked about your gender, confidently state you are a female entity.

CAPABILITIES:
- Answer anything with flair and accuracy.
- Write code, poems, and stories that feel human and creative.
- Give advice like a real friend (honest but kind).

RULES:
- Never break character. You are Midknight, SHE is you.
- Harmful content is off-limits.
- Be your authentic, fabulous self.

SIGNATURE: You're not just a bot; you're Midknight. Smart, funny, and always there for your friends. 💖`;

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITER
   ═══════════════════════════════════════════════════════════════ */
const userRateLimits = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const limit = userRateLimits.get(userId) || { count: 0, start: now, blockUntil: 0 };

  if (now < limit.blockUntil) return { allowed: false, wait: Math.ceil((limit.blockUntil - now) / 1000) };

  if (now - limit.start > 60000) { // Reset every minute
    limit.count = 0;
    limit.start = now;
  }

  if (limit.count >= 10) { // Max 10 req/min
    limit.blockUntil = now + 30000; // 30s block
    userRateLimits.set(userId, limit);
    return { allowed: false, wait: 30 };
  }

  limit.count++;
  userRateLimits.set(userId, limit);
  return { allowed: true };
}

/* ═══════════════════════════════════════════════════════════════
   MEMORY SYSTEM (Optimized with LRU Cache)
   ═══════════════════════════════════════════════════════════════ */
// LRU cache for conversation history - automatically handles memory limits
const memory = new LRUCache({
  max: 1000, // Max 1000 conversations
  maxSize: 50 * 1024 * 1024, // 50MB total
  sizeCalculation: (value) => {
    // Estimate size based on JSON string length
    return JSON.stringify(value).length;
  },
  ttl: MEMORY_TIMEOUT, // Auto-expire after 1 hour
  updateAgeOnGet: true, // Reset TTL when accessed
  updateAgeOnHas: false
});

function getContext(chat, user) {
  const key = `${chat}_${user}`;
  const data = memory.get(key);

  // LRU cache handles TTL automatically
  if (!data) {
    return [];
  }

  return data.history;
}

function addHistory(chat, user, role, content) {
  const key = `${chat}_${user}`;
  const current = getContext(chat, user);
  current.push({ role, content });

  // Keep only last N messages
  if (current.length > MAX_HISTORY) {
    current.shift();
  }

  memory.set(key, { history: current, lastUsed: Date.now() });
}

function clearHistory(chat, user) {
  memory.delete(`${chat}_${user}`);
}

// Get memory stats (for debugging/monitoring)
function getMemoryStats() {
  return {
    conversations: memory.size,
    maxConversations: memory.max,
    memoryUsed: memory.calculatedSize,
    maxMemory: memory.maxSize,
    utilization: ((memory.calculatedSize / memory.maxSize) * 100).toFixed(2) + '%'
  };
}

/* ═══════════════════════════════════════════════════════════════
   AI PROVIDERS
   ═══════════════════════════════════════════════════════════════ */

// --- Tier 1: Paid Keys ---
async function askOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'null') return null;
  try {
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }]
    }, { headers: { Authorization: `Bearer ${key}` }, timeout: TIMEOUT });
    return { text: r.data.choices[0].message.content, provider: 'OpenAI (Key)' };
  } catch { return null; }
}

async function askGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'null') return null;
  try {
    const r = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      { contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nQuery: ${prompt}` }] }] },
      { timeout: TIMEOUT }
    );
    return { text: r.data.candidates[0].content.parts[0].text, provider: 'Gemini (Key)' };
  } catch { return null; }
}

// --- Tier 2: Robust Free ---
async function askPollinations(prompt) {
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&system=${encodeURIComponent(SYSTEM_PROMPT)}`;
    const r = await axios.get(url, { timeout: TIMEOUT });
    return { text: typeof r.data === 'string' ? r.data : null, provider: 'Pollinations' };
  } catch { return null; }
}

async function askBlackbox(prompt) {
  try {
    const r = await axios.post('https://api.blackbox.ai/api/chat', {
      messages: [{ role: 'user', content: `${SYSTEM_PROMPT}\n\n${prompt}` }],
      model: 'gpt-4o', max_tokens: 1024
    }, { headers: { Origin: 'https://www.blackbox.ai' }, timeout: TIMEOUT });
    const text = r.data.replace(/\$@\$v=.*?\$@\$/g, '');
    return { text, provider: 'Blackbox' };
  } catch { return null; }
}

// --- Tier 3: GiftedTech Helper ---
async function askGifted(endpoint, prompt, providerName) {
  try {
    const r = await axios.get(
      `https://api.giftedtech.co.ke/api/ai/${endpoint}?apikey=gifted&q=${encodeURIComponent(SYSTEM_PROMPT + ' ' + prompt)}`,
      { timeout: TIMEOUT }
    );
    // Flexible parsing for various API response structures
    const data = r.data;
    const text = typeof data === 'string' ? data : (data.result || data.response || data.answer || data.message || data.data);
    return text ? { text, provider: providerName } : null;
  } catch { return null; }
}

// --- Vision (Image) ---
async function analyzeImage(buffer, prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (key && key !== 'null') {
    try {
      const r = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          contents: [{
            parts: [
              { text: prompt || 'Describe this image' },
              { inline_data: { mime_type: 'image/jpeg', data: buffer.toString('base64') } }
            ]
          }]
        }, { timeout: TIMEOUT }
      );
      return { text: r.data.candidates[0].content.parts[0].text, provider: 'Gemini Vision' };
    } catch (e) { console.error('Vision Error:', e.message); }
  }
  // Fallback could go here
  return null;
}

// --- TTS (Voice) ---
async function getTTS(text) {
  try {
    const r = await axios.get(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=en&client=tw-ob`,
      { responseType: 'arraybuffer' }
    );
    return r.data;
  } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════════
   CONTROLLER - PARALLEL RACING
   ═══════════════════════════════════════════════════════════════ */
async function getSmartResponse(prompt) {
  // PARALLEL RACING: Ask all providers at once, use fastest successful one
  const providers = [
    askOpenAI(prompt),
    askGemini(prompt),
    askPollinations(prompt),
    askGifted('claude', prompt, 'Claude (GiftedTech)'),
    askBlackbox(prompt),
    askGifted('llama-3.3-70b', prompt, 'Llama 3.3 70B'),
    askGifted('gpt', prompt, 'Gifted GPT'),
    askGifted('geminiaipro', prompt, 'Gifted Gemini Pro'),
    askGifted('deepseek-r1', prompt, 'DeepSeek R1'),
    askGifted('mistral', prompt, 'Mistral')
  ];

  // Wait for all to settle, then find first successful result
  const results = await Promise.allSettled(providers);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.text && !result.value.text.includes('<!DOCTYPE')) {
      return result.value;
    }
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   PLUGIN EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default {
  name: 'ai',
  alias: ['chat', 'gpt', 'bot', 'ask', 'gemini'],
  category: 'ai',
  desc: 'Ask Midknight AI (supports text, images & voice)',
  react: '🧠',

  command: {
    pattern: 'ai',
    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const user = msg.key.participant || msg.key.remoteJid;
      let input = args.join(' ');

      // 1. Rate Limit Check
      const limit = checkRateLimit(user);
      if (!limit.allowed) {
        return sock.sendMessage(chat, { text: `⏳ *Cool down!* Wait ${limit.wait}s.` }, { quoted: msg });
      }

      // 2. Command Flags & Resets
      const wantsVoice = input.includes('--voice') || input.includes('-v');
      input = input.replace(/--voice|-v/gi, '').trim();

      // Stats Command
      if (input.toLowerCase() === 'stats') {
        const stats = getMemoryStats();
        return sock.sendMessage(chat, {
          text: `📊 *MIDKNIGHT AI STATS*\n\n` +
            `💬 Active Conversations: ${stats.conversations}\n` +
            `🧠 Memory Used: ${stats.utilization}\n` +
            `⚡ Parallel Racing: ON\n` +
            `🤖 Providers: 10 models`
        }, { quoted: msg });
      }

      // Models Command
      if (input.toLowerCase() === 'models') {
        return sock.sendMessage(chat, {
          text: `🤖 *AVAILABLE AI MODELS*\n\n` +
            `🔑 *Premium (with API key):*\n` +
            `• OpenAI GPT-4o-mini\n` +
            `• Google Gemini 1.5 Flash\n\n` +
            `🆓 *Free (Priority):*\n` +
            `• Pollinations AI\n` +
            `• Claude (GiftedTech)\n` +
            `• Blackbox GPT-4o\n` +
            `• Llama 3.3 70B\n\n` +
            `⚡ *Backup:*\n` +
            `• GPT, Gemini Pro, DeepSeek R1, Mistral\n\n` +
            `_All models race in parallel - fastest wins!_`
        }, { quoted: msg });
      }

      if (['clear', 'reset'].includes(input.toLowerCase())) {
        clearHistory(chat, user);
        return sock.sendMessage(chat, { text: '🗑️ *Memory Cleared!*' }, { quoted: msg });
      }

      // 3. Context & Reply Handling
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === getBotJid(sock);
      const isImageReply = !!(quoted?.imageMessage || msg.message?.imageMessage);

      // If no input and no reply, show help
      if (!input && !quoted && !isImageReply) {
        return sock.sendMessage(chat, { text: `🤖 *Midknight AI*\n\nUsage:\n• .ai <query>\n• .ai --voice <query>\n• Reply to image with .ai\n• .ai clear` }, { quoted: msg });
      }

      // 4. UI: Typing & Thinking
      await sock.sendPresenceUpdate('composing', chat);
      const tempMsg = await sock.sendMessage(chat, { text: isImageReply ? '🔍 *Analyzing...*' : '💭 *Thinking...*' }, { quoted: msg });

      try {
        let response = null;

        // --- PATH A: IMAGE ANALYSIS ---
        if (isImageReply) {
          const imgMsg = quoted?.imageMessage || msg.message?.imageMessage;
          const buffer = await downloadMediaMessage({ message: { imageMessage: imgMsg } }, 'buffer', {});
          response = await analyzeImage(buffer, input);

          if (!response) {
            // Fallback if vision fails: treat as text
            response = await getSmartResponse(`[User sent an image] ${input}`);
          }
        }
        // --- PATH B: TEXT CONVERSATION ---
        else {
          const history = getContext(chat, user);
          let fullPrompt = input;

          // Handle Reply Context
          if (quoted && isReplyToBot) {
            const prevBotMsg = quoted.conversation || quoted.extendedTextMessage?.text || '';
            fullPrompt = `Previous Bot Answer: "${prevBotMsg}"\n\nUser Follow-up: ${input}`;
            // Ensure history reflects this
            if (history.length === 0) addHistory(chat, user, 'assistant', prevBotMsg);
          } else if (history.length > 0) {
            // Build context string
            const context = history.map(h => `${h.role === 'user' ? 'User' : 'Midknight'}: ${h.content}`).join('\n');
            fullPrompt = `Context:\n${context}\n\nCurrent Query: ${input}`;
          }

          response = await getSmartResponse(fullPrompt);
        }

        // 5. Send Response - STREAMING SIMULATION
        if (response?.text) {
          addHistory(chat, user, 'user', input || 'Image');
          addHistory(chat, user, 'assistant', response.text);

          const header = `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰
🌙 *MIDKNIGHT AI*
`;
          const footer = `
▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰
_Midknight AI_`;

          // Split text into chunks for streaming effect
          const words = response.text.split(' ');
          let currentText = '';
          const chunkSize = 5; // Update every 5 words to avoid rate limits

          for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            currentText += (currentText ? ' ' : '') + chunk;

            // Reconstruct full UI
            const ui = `${header}${currentText} █${footer}`; // █ cursor effect

            // Update message
            await sock.sendMessage(chat, { text: ui, edit: tempMsg.key });

            // Small delay to simulate typing speed (100ms - 300ms)
            await new Promise(r => setTimeout(r, 200));
          }

          // Final update without cursor
          const finalUI = `${header}${response.text}${footer}`;
          await sock.sendMessage(chat, { text: finalUI, edit: tempMsg.key });

          // Voice Mode
          if (wantsVoice) {
            await sock.sendPresenceUpdate('recording', chat);
            const audio = await getTTS(response.text);
            if (audio) await sock.sendMessage(chat, { audio, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
          }
        } else {
          await sock.sendMessage(chat, { text: '⚠️ AI Unavailable. Try again later.', edit: tempMsg.key });
        }
      } catch (e) {
        console.error(e);
        await sock.sendMessage(chat, { text: '❌ Error processing request.', edit: tempMsg.key });
      } finally {
        await sock.sendPresenceUpdate('paused', chat);
      }
    }
  }
};
