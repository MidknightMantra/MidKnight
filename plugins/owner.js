// Fix for CommonJS module compatibility
import pkg from '@whiskeysockets/baileys';
const { proto } = pkg || {};

/* -------------------------------------------------------
   ⚙️ CONFIGURATION
------------------------------------------------------- */
const OWNER_NAME = 'Midknight Mantra';
const OWNER_NUMBER = '254105745317';
const OWNER_ORG = 'Midknight Corp';
const GITHUB_URL = 'https://github.com/MidknightMantra/Midknight';
const INSTAGRAM_URL = 'https://instagram.com/midknightmantra';

/* -------------------------------------------------------
   PLUGIN
------------------------------------------------------- */
export default {
  name: 'owner',
  alias: ['creator', 'dev'],

  command: {
    pattern: 'owner',
    desc: 'Bot owner\'s contact card',
    category: 'general',
    react: '👑',

    run: async ({ sock, msg }) => {
      const chat = msg.key.remoteJid;

      // 1. Construct vCard (VCF)
      const vcard =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        `FN:${OWNER_NAME}\n` + // Full Name
        `ORG:${OWNER_ORG};\n` + // Organization
        `TEL;type=CELL;type=VOICE;waid=${OWNER_NUMBER}:${OWNER_NUMBER}\n` + // WhatsApp ID
        'END:VCARD';

      // 2. React
      try { await sock.sendMessage(chat, { react: { text: '👑', key: msg.key } }); } catch { }

      // 3. Send Contact Message
      await sock.sendMessage(chat, {
        contacts: {
          displayName: OWNER_NAME,
          contacts: [{ vcard }]
        }
      }, { quoted: msg });

      // 4. Send Follow-up Text with Links
      const caption =
        '👑 *Developer Info*\n\n' +
        `👤 *Name:* ${OWNER_NAME}\n` +
        `📞 *Chat:* wa.me/${OWNER_NUMBER}\n` +
        `💻 *GitHub:* ${GITHUB_URL}\n` +
        `📸 *Instagram:* ${INSTAGRAM_URL}\n\n` +
        '_Feel free to contact for updates, bugs, or feature requests._';

      // Send with Link Preview (Context Info)
      return sock.sendMessage(chat, {
        text: caption,
        contextInfo: {
          externalAdReply: {
            title: 'Midknight - The Sentinel',
            body: 'Contact the Creator',
            thumbnailUrl: 'https://i.imgur.com/3LgHj2N.jpeg',
            sourceUrl: GITHUB_URL,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg });
    }
  }
};
