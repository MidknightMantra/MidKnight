import * as JimpPkg from 'jimp';
// Handle Jimp interop (CJS vs ESM default)
const Jimp = JimpPkg.default || JimpPkg;
import { jidToPhone } from '../src/utils/jid.js';
import db from '../src/database.js';

// Load Collection
const welcomeDB = db.collection('welcome');

/* ═══════════════════════════════════════════════════════════════
   IMAGE GENERATOR
   ═══════════════════════════════════════════════════════════════ */
async function generateCard(action, userJid, groupSubject, ppUrl) {
    try {
        // 1. Create Background (Black/Dark Blue Gradient)
        const width = 1280;
        const height = 720;
        const bg = new Jimp(width, height, '#0f172a'); // Slate 900

        // 2. Load Profile Picture
        let pp;
        try {
            pp = await Jimp.read(ppUrl || 'https://i.imgur.com/6D0Z13b.jpeg');
        } catch {
            pp = await Jimp.read('https://i.imgur.com/6D0Z13b.jpeg');
        }
        pp.resize(400, 400).circle();

        // 3. Load Fonts
        const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const fontSub = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

        // 4. Composite
        bg.composite(pp, (width - 400) / 2, 100); // Center PP

        // 5. Add Text
        const titleText = action === 'add' ? 'WELCOME' : 'GOODBYE';
        const userPhone = '@' + jidToPhone(userJid);
        const subtitle = action === 'add'
            ? `Welcome to ${groupSubject}`
            : `Left ${groupSubject}`;

        // Simple centering via manual padding (Jimp text alignment is basic)
        bg.print(fontTitle, 0, 520, { text: titleText, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
        bg.print(fontTitle, 0, 600, { text: userPhone, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
        bg.print(fontSub, 0, 680, { text: subtitle, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);

        return await bg.getBufferAsync(Jimp.MIME_JPEG);
    } catch (e) {
        console.error('Welcome Card Error:', e);
        return null;
    }
}

/* ═══════════════════════════════════════════════════════════════
   PLUGIN EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default {
    name: 'welcome',
    category: 'group',
    desc: 'Enable/disable welcome cards for groups',

    // Command to toggle
    command: {
        pattern: 'welcome',
        desc: 'Toggle welcome messages on/off',
        category: 'group',
        run: async ({ sock, msg, args, isGroup, chat }) => {
            if (!isGroup) return sock.sendMessage(chat, { text: '⚠️ Groups only.' }, { quoted: msg });

            // Toggle Logic using DB
            const isEnabled = welcomeDB.get(chat);
            const newState = !isEnabled;
            welcomeDB.set(chat, newState);

            return sock.sendMessage(chat, {
                text: `👋 *Welcome Protocol*\n\nStatus: ${newState ? '✅ ENABLED' : '❌ DISABLED'}\n\n_I will now ${newState ? 'greet' : 'ignore'} new members._`
            }, { quoted: msg });
        }
    },

    // Event Listener
    onGroupUpdate: async ({ sock, update }) => {
        const { id, participants, action } = update;

        // Check DB
        if (!welcomeDB.get(id)) return;

        // Only handle add/remove
        if (action !== 'add' && action !== 'remove') return;

        try {
            // Get Group Metadata
            const groupMetadata = await sock.groupMetadata(id);
            const groupSubject = groupMetadata.subject;

            for (const participant of participants) {
                // Get PP
                let ppUrl;
                try {
                    ppUrl = await sock.profilePictureUrl(participant, 'image');
                } catch {
                    ppUrl = 'https://i.imgur.com/6D0Z13b.jpeg';
                }

                // Generate Card
                const cardBuffer = await generateCard(action, participant, groupSubject, ppUrl);

                // Caption
                const mention = `@${jidToPhone(participant)}`;
                const welcomeText = `👋 *Hello ${mention}!*\n\nWelcome to *${groupSubject}*.\nRead the description and have fun! ✨`;
                const goodbyeText = `👋 *Goodbye ${mention}*.\n\nWe'll miss you (maybe). 🍂`;

                const caption = action === 'add' ? welcomeText : goodbyeText;

                // Send
                if (cardBuffer) {
                    await sock.sendMessage(id, { image: cardBuffer, caption, mentions: [participant] });
                } else {
                    await sock.sendMessage(id, { text: caption, mentions: [participant] });
                }
            }
        } catch (e) {
            console.error('Welcome Plugin Error:', e);
        }
    }
};
