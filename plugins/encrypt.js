import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'encrypt',
    alias: ['obfuscate', 'jsenc', 'protect'],

    command: {
        pattern: 'encrypt',
        desc: 'Obfuscate JavaScript code (Normal, Medium, Hard)',
        category: 'tools',
        react: '🛡️',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Usage: .encrypt <level> <code>
            // Levels: normal (v1), medium (v2), hard (v3)
            // Default: normal

            let level = 'normal';
            let code = '';

            if (args.length > 0) {
                const firstArg = args[0].toLowerCase();
                if (['normal', 'medium', 'hard', 'v1', 'v2', 'v3'].includes(firstArg)) {
                    level = firstArg;
                    code = args.slice(1).join(' ');
                } else {
                    code = args.join(' ');
                }
            }

            // Check quoted text
            if (!code) {
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                code = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;
            }

            if (!code) {
                return sock.sendMessage(chat, {
                    text: '🛡️ *Usage:* `.encrypt <normal|medium|hard> <code>`\nExample: `.encrypt hard console.log("Hello")`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '🛡️', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '🛡️ *Midknight is obfuscating...*' }, { quoted: msg });

            try {
                let endpoint = 'encrypt'; // Default (Normal)
                let levelName = 'Normal';

                if (level === 'medium' || level === 'v2') {
                    endpoint = 'encryptv2';
                    levelName = 'Medium';
                } else if (level === 'hard' || level === 'v3') {
                    endpoint = 'encryptv3';
                    levelName = 'Hard';
                }

                const apiUrl = `https://api.giftedtech.co.ke/api/tools/${endpoint}?apikey=gifted&code=${encodeURIComponent(code)}`;

                const response = await axios.get(apiUrl);
                // API likely returns { result: "..." } or just the string?
                // Based on previous tools, it's often .result
                const result = response.data?.result || response.data?.encrypted || response.data;

                if (!result || typeof result !== 'string') {
                    throw new Error('API Error or Invalid Response');
                }

                // Send as Document if too long, else text
                if (result.length > 1500) {
                    await sock.sendMessage(chat, {
                        document: Buffer.from(result),
                        mimetype: 'application/javascript',
                        fileName: `Midknight_Obfuscated_${levelName}.js`,
                        caption: `╭━━━『 🛡️ MIDKNIGHT PROTECT 』━━━╮
┃
┃ 🔒 *Level:* ${levelName}
┃ 💾 *Size:* ${result.length} bytes
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Code, shrouded in mystery.”_`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chat, {
                        text: `╭━━━『 🛡️ MIDKNIGHT PROTECT 』━━━╮
┃
┃ 🔒 *Level:* ${levelName}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

\`\`\`javascript
${result}
\`\`\``
                    }, { quoted: msg });
                }

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Encrypt Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to obfuscate code.' }, { quoted: msg });
            }
        },
    },
};
