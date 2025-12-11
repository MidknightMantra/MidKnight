import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'binary',
    alias: ['bin', 'ebinary', 'dbinary'],

    command: {
        pattern: 'binary',
        desc: 'Encode or Decode Binary text',
        category: 'tools',
        react: '0️⃣',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Usage: .binary <enc|dec> <text>

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
                    text: '0️⃣ *Usage:* `.binary <enc|dec> <text>`\nExample: `.binary enc Hello`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '1️⃣', key: msg.key } }); } catch { }

            try {
                let endpoint = mode === 'encode' ? 'ebinary' : 'dbinary';
                const apiUrl = `https://api.giftedtech.co.ke/api/tools/${endpoint}?apikey=gifted&query=${encodeURIComponent(text)}`;

                const response = await axios.get(apiUrl);
                const result = response.data?.result || response.data?.string || response.data;

                if (!result) {
                    throw new Error('API Error');
                }

                await sock.sendMessage(chat, {
                    text: `╭━━━『 0️⃣ MIDKNIGHT BINARY 』━━━╮
┃
┃ 📥 *Input:* ${text.length > 20 ? text.slice(0, 20) + '...' : text}
┃ 📤 *Output:*
┃ ${result}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“01010110 01100101 01110011 01110000 01100101 01110010 01110010”_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Binary Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to process Binary.' }, { quoted: msg });
            }
        },
    },
};
