import axios from 'axios';

/* ---------------------------------------------------
   API: GiftedTech Romance Endpoints
--------------------------------------------------- */
async function getGiftedText(endpoint) {
    try {
        const r = await axios.get(`https://api.giftedtech.co.ke/api/fun/${endpoint}?apikey=gifted`, { timeout: 8000 });
        // APIs usually return { success: true, result: "text" } or similar
        return r.data?.result || r.data?.message || r.data?.pickup || r.data?.flirt || r.data?.love || null;
    } catch {
        return null;
    }
}

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'romance',
    alias: ['flirt', 'love', 'pickup', 'rizz'],

    command: {
        pattern: 'romance',
        desc: 'Romantic lines and quotes',
        category: 'fun',
        react: '💘',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Determine command based on what triggered it
            const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const cmd = textContent.split(' ')[0].slice(1).toLowerCase();

            let endpoint = '';
            let title = '';
            let footer = '';
            let emoji = '';

            switch (cmd) {
                case 'flirt':
                case 'rizz':
                    endpoint = 'flirt';
                    title = 'MIDKNIGHT FLIRT';
                    footer = 'Smooth operator.';
                    emoji = '😏';
                    break;
                case 'love':
                    endpoint = 'love';
                    title = 'MIDKNIGHT LOVE';
                    footer = 'From the heart.';
                    emoji = '❤️';
                    break;
                case 'pickup':
                case 'pickupline':
                    endpoint = 'pickupline';
                    title = 'MIDKNIGHT PICKUP';
                    footer = 'Did it hurt when you fell?';
                    emoji = '😉';
                    break;
                default:
                    // Default to pickup line if .romance is used
                    endpoint = 'pickupline';
                    title = 'MIDKNIGHT ROMANCE';
                    footer = 'Love is in the air.';
                    emoji = '🌹';
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: emoji, key: msg.key } }); } catch { }

            const result = await getGiftedText(endpoint);

            if (!result) {
                return sock.sendMessage(chat, { text: '❌ The romance server is feeling shy. Try again.' }, { quoted: msg });
            }

            return sock.sendMessage(
                chat,
                {
                    text: `╭━━━『 ${emoji} ${title} 』━━━╮
┃
┃ ${result}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“${footer}”_`
                },
                { quoted: msg }
            );
        },
    },
};
