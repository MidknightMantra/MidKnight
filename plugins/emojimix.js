import axios from 'axios';

/* -------------------------------------------------------
   ENGINE 1: GIFTED TECH
------------------------------------------------------- */
async function engineGifted(emoji1, emoji2) {
    try {
        const apiUrl = `https://api.giftedtech.co.ke/api/tools/emojimix?apikey=gifted&emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}`;
        const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 10000 });

        // Check if it's a JSON error
        try {
            const json = JSON.parse(response.data.toString());
            if (json.success === false || json.message) return null;
        } catch (e) {
            // Not JSON, so it's the image buffer
        }

        return response.data;
    } catch (e) {
        return null;
    }
}

/* -------------------------------------------------------
   ENGINE 2: TENOR EMOJI KITCHEN
------------------------------------------------------- */
async function engineTenor(emoji1, emoji2) {
    try {
        const apiUrl = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPubB-1qKMPmxjpE&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;
        const response = await axios.get(apiUrl, { timeout: 10000 });

        if (response.data?.results?.[0]?.media_formats?.png_transparent?.url) {
            const imageUrl = response.data.results[0].media_formats.png_transparent.url;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            return imageResponse.data;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/* -------------------------------------------------------
   ENGINE 3: EMOJI KITCHEN DIRECT
------------------------------------------------------- */
async function engineEmojiKitchen(emoji1, emoji2) {
    try {
        // Convert emojis to codepoints
        const code1 = emoji1.codePointAt(0).toString(16);
        const code2 = emoji2.codePointAt(0).toString(16);

        // Try both combinations
        const urls = [
            `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${code1}/u${code1}_u${code2}.png`,
            `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${code2}/u${code2}_u${code1}.png`
        ];

        for (const url of urls) {
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
                if (response.data) return response.data;
            } catch (e) {
                continue;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'emojimix',
    alias: ['mix', 'emix'],

    command: {
        pattern: 'emojimix',
        desc: 'Mix two emojis into a sticker (Multi-Engine)',
        category: 'fun',
        react: '🧪',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Parse emojis from args
            const input = args.join('').replace(/\+/g, '');

            // Simple regex to find emojis
            const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
            const matches = input.match(emojiRegex);

            if (!matches || matches.length < 2) {
                return sock.sendMessage(chat, {
                    text: '🧪 *Usage:* `.mix <emoji1> <emoji2>`\nExample: `.mix 😂 🙄`'
                }, { quoted: msg });
            }

            const emoji1 = matches[0];
            const emoji2 = matches[1];

            // React
            try { await sock.sendMessage(chat, { react: { text: '🧪', key: msg.key } }); } catch { }

            try {
                let stickerData = null;

                // Waterfall: Try each engine
                if (!stickerData) stickerData = await engineGifted(emoji1, emoji2);
                if (!stickerData) stickerData = await engineTenor(emoji1, emoji2);
                if (!stickerData) stickerData = await engineEmojiKitchen(emoji1, emoji2);

                if (!stickerData) {
                    return sock.sendMessage(chat, {
                        text: '❌ These emojis cannot be mixed or are not supported.'
                    }, { quoted: msg });
                }

                // Send as Sticker
                await sock.sendMessage(chat, {
                    sticker: stickerData
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Emojimix Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to mix emojis.' }, { quoted: msg });
            }
        },
    },
};
