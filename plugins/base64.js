import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'base64',
    alias: ['b64', 'encode', 'decode'],

    command: {
        pattern: 'base64',
        desc: 'Encode or Decode Base64 text',
        category: 'tools',
        react: '🔐',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Usage: .b64 <enc|dec> <text>
            // Or just .b64 <text> (defaults to encode)

            let mode = 'encode';
            let text = '';

            if (args.length > 0) {
                if (args[0].toLowerCase() === 'dec' || args[0].toLowerCase() === 'decode') {
                    mode = 'decode';
                    text = args.slice(1).join(' ');
                } else if (args[0].toLowerCase() === 'enc' || args[0].toLowerCase() === 'encode') {
                    mode = 'encode';
                    text = args.slice(1).join(' ');
                } else {
                    text = args.join(' ');
                }
            }

            // Check quoted text
            if (!text) {
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                text = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;
            }

            if (!text) {
                return sock.sendMessage(chat, {
                    text: '🔐 *Usage:* `.b64 <enc|dec> <text>`\nExample: `.b64 enc Hello World`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '🔐', key: msg.key } }); } catch { }

            try {
                // The user provided API is "ebase" (encode base?) and "dbase" (decode base?)
                // The request shows "ebase" for both? Let's assume "ebase" is encode and "dbase" is decode based on common naming.
                // Wait, the user provided "ebase" twice in the prompt. 
                // Let's assume standard behavior:
                // Encode: https://api.giftedtech.co.ke/api/tools/ebase?apikey=gifted&query=...
                // Decode: https://api.giftedtech.co.ke/api/tools/dbase?apikey=gifted&query=... (Assuming dbase exists, if not we use local JS)

                // Actually, for Base64, local JS is faster and more reliable than an API.
                // But since the user EXPLICITLY requested to build from the API, I should try to use it.
                // However, if the API is just "ebase", maybe it toggles? Or maybe "dbase" is the other one.
                // Let's try to use the API for "ebase" as requested, and maybe fallback to local for decode if API is unclear.
                // But to be safe and "Midknight Way" (Robustness), I will implement LOCAL processing for Base64.
                // It's instant, no API downtime, and supports all characters.
                // WAIT, the user said "build THIS api". I must use the API if possible.
                // Let's assume "ebase" = Encode Base64.
                // I will check if "dbase" exists or if "ebase" handles both.
                // Given the prompt only showed "ebase", I will use it for encoding.
                // For decoding, I will use local buffer to ensure it works if the user didn't provide a decode API.

                let result = '';

                if (mode === 'encode') {
                    const apiUrl = `https://api.giftedtech.co.ke/api/tools/ebase?apikey=gifted&query=${encodeURIComponent(text)}`;
                    const response = await axios.get(apiUrl);
                    // API likely returns { result: "..." }
                    result = response.data?.result || response.data?.string || response.data;

                    // Fallback if API fails or returns object
                    if (typeof result !== 'string') {
                        result = Buffer.from(text).toString('base64');
                    }
                } else {
                    // Decode - Use local Buffer as no API was explicitly provided for decode in the prompt (both were ebase)
                    // But wait, maybe the second link in prompt was meant to be dbase?
                    // "https://api.giftedtech.co.ke/api/tools/ebase... , https://api.giftedtech.co.ke/api/tools/ebase..."
                    // Both are identical.
                    // I'll use local decoding for reliability.
                    result = Buffer.from(text, 'base64').toString('utf-8');
                }

                await sock.sendMessage(chat, {
                    text: `╭━━━『 🔐 MIDKNIGHT BASE64 』━━━╮
┃
┃ 📥 *Input:* ${text.length > 20 ? text.slice(0, 20) + '...' : text}
┃ 📤 *Output:*
┃ ${result}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Data, transformed.”_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Base64 Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to process Base64.' }, { quoted: msg });
            }
        },
    },
};
