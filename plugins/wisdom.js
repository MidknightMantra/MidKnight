import axios from 'axios';

/* ---------------------------------------------------
   API: GiftedTech Wisdom Endpoints
--------------------------------------------------- */
async function getGiftedContent(endpoint) {
    try {
        const r = await axios.get(`https://api.giftedtech.co.ke/api/fun/${endpoint}?apikey=gifted`, { timeout: 8000 });
        // APIs usually return { success: true, result: "text" } or specific keys
        return r.data?.result || r.data?.message || r.data?.quote || r.data?.advice || r.data?.gratitude || r.data?.halloween || null;
    } catch {
        return null;
    }
}

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'wisdom',
    alias: ['quote', 'advice', 'gratitude', 'halloween', 'spooky'],

    command: {
        pattern: 'wisdom',
        desc: 'Get quotes, advice, and more',
        category: 'fun',
        react: '🧠',

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
                case 'quote':
                    endpoint = 'quotes';
                    title = 'MIDKNIGHT QUOTE';
                    footer = 'Words of wisdom.';
                    emoji = '📜';
                    break;
                case 'advice':
                    endpoint = 'advice';
                    title = 'MIDKNIGHT ADVICE';
                    footer = 'Take it or leave it.';
                    emoji = '💡';
                    break;
                case 'gratitude':
                    endpoint = 'gratitude';
                    title = 'MIDKNIGHT GRATITUDE';
                    footer = 'Be thankful.';
                    emoji = '🙏';
                    break;
                case 'halloween':
                case 'spooky':
                    endpoint = 'halloween';
                    title = 'MIDKNIGHT SPOOKY';
                    footer = 'Boo!';
                    emoji = '🎃';
                    break;
                default:
                    // Default to quote
                    endpoint = 'quotes';
                    title = 'MIDKNIGHT WISDOM';
                    footer = 'Food for thought.';
                    emoji = '🧠';
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: emoji, key: msg.key } }); } catch { }

            const result = await getGiftedContent(endpoint);

            if (!result) {
                return sock.sendMessage(chat, { text: '❌ The wisdom scrolls are currently illegible. Try again.' }, { quoted: msg });
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
