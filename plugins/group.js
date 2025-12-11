import { getBotJid, phoneToJid } from '../src/utils/jid.js';

const antilinkGroups = new Set();
const welcomeGroups = new Set();

/* -------------------------------------------------------
   HELPER: Get Permissions
------------------------------------------------------- */
async function getGroupPermissions(sock, chat, authorId) {
  try {
    const meta = await sock.groupMetadata(chat);
    const groupAdmins = meta.participants.filter(p => p.admin !== null).map(p => p.id);

    const botId = getBotJid(sock);
    const isBotAdmin = groupAdmins.includes(botId);
    const isSenderAdmin = groupAdmins.includes(authorId);

    return { isBotAdmin, isSenderAdmin, participants: meta.participants };
  } catch (e) {
    return { isBotAdmin: false, isSenderAdmin: false, participants: [] };
  }
}

export default {
  name: 'group',
  alias: [
    'groupinfo', 'ginfo',                 // Info
    'welcome', 'goodbye',                 // Greeter
    'kick', 'ban', 'remove',              // Moderation
    'add', 'promote', 'demote',
    'hidetag', 'tagall', 'everyone',
    'antilink', 'linkguard'               // Security
  ],

  command: {
    pattern: 'group',
    desc: 'Complete Group Suite (Admin, Security, Greetings)',
    category: 'admin',
    react: '🛡️',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;

      const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const command = textContent.split(' ')[0].slice(1).toLowerCase();

      // 1. Group Check
      if (!chat.endsWith('@g.us')) {
        return await sock.sendMessage(chat, { text: '❌ Group command only.' }, { quoted: msg });
      }

      /* =======================================================
               FEATURE: GROUP INFO (Public)
            ======================================================= */
      if (['groupinfo', 'ginfo'].includes(command)) {
        try {
          await sock.sendMessage(chat, { react: { text: '📊', key: msg.key } });
          const meta = await sock.groupMetadata(chat);
          const desc = meta.desc?.toString() || 'No description.';
          let pfp;
          try { pfp = await sock.profilePictureUrl(chat, 'image'); } catch { pfp = null; }

          const infoText =
            `📊 *GROUP INTELLIGENCE*
────────────────
🏷️ *Name:* ${meta.subject}
👥 *Members:* ${meta.participants.length}
📅 *Created:* ${new Date(meta.creation * 1000).toLocaleDateString()}
────────────────
📝 *Description:*
${desc}`;

          if (pfp) await sock.sendMessage(chat, { image: { url: pfp }, caption: infoText }, { quoted: msg });
          else await sock.sendMessage(chat, { text: infoText }, { quoted: msg });
          return;
        } catch { return; }
      }

      /* =======================================================
               ADMIN GATEWAY
            ======================================================= */
      const { isBotAdmin, isSenderAdmin, participants } = await getGroupPermissions(sock, chat, sender);

      if (!isSenderAdmin) {
        return await sock.sendMessage(chat, { text: '⚠️ *Access Denied:* You are not an admin.' }, { quoted: msg });
      }

      /* =======================================================
               FEATURE: WELCOME TOGGLE
            ======================================================= */
      if (command === 'welcome') {
        const mode = args[0]?.toLowerCase();
        if (mode === 'on') {
          welcomeGroups.add(chat);
          return sock.sendMessage(chat, { text: '👋 *Welcome System: ACTIVE*\n_I will greet new members._' }, { quoted: msg });
        } else if (mode === 'off') {
          welcomeGroups.delete(chat);
          return sock.sendMessage(chat, { text: '👋 *Welcome System: MUTED*' }, { quoted: msg });
        } else {
          return sock.sendMessage(chat, { text: 'Usage: `.welcome on` or `.welcome off`' }, { quoted: msg });
        }
      }

      /* =======================================================
               FEATURE: ANTI-LINK TOGGLE
            ======================================================= */
      if (['antilink', 'linkguard'].includes(command)) {
        const mode = args[0]?.toLowerCase();
        if (mode === 'on') {
          antilinkGroups.add(chat);
          return sock.sendMessage(chat, { text: '🛡️ *Anti-Link Protocol: ONLINE*' }, { quoted: msg });
        } else if (mode === 'off') {
          antilinkGroups.delete(chat);
          return sock.sendMessage(chat, { text: '🛡️ *Anti-Link Protocol: OFFLINE*' }, { quoted: msg });
        } else {
          return sock.sendMessage(chat, { text: 'Usage: `.antilink on` or `.antilink off`' }, { quoted: msg });
        }
      }

      /* =======================================================
               FEATURE: ADMIN TOOLS
            ======================================================= */
      if (!isBotAdmin) return sock.sendMessage(chat, { text: '⚠️ I need Admin privileges.' }, { quoted: msg });

      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      let target = quoted?.participant || quoted?.mentionedJid?.[0];
      if (!target && args[0]) target = phoneToJid(args[0]);

      switch (command) {
        case 'hidetag':
        case 'tagall':
        case 'everyone':
          // Fixed: Removed invalid placeholder text
          const alert = args.join(' ') || '⚠️ *Admin Alert*';
          await sock.sendMessage(chat, { text: alert, mentions: participants.map(p => p.id) }, { quoted: msg });
          break;
        case 'kick':
        case 'remove':
        case 'ban':
          if (!target) return;
          await sock.groupParticipantsUpdate(chat, [target], 'remove');
          await sock.sendMessage(chat, { text: '🚫 *User Removed*', mentions: [target] });
          break;
        case 'add':
          if (!target) return;
          await sock.groupParticipantsUpdate(chat, [target], 'add');
          await sock.sendMessage(chat, { text: '✅ *User Added*', mentions: [target] });
          break;
        case 'promote':
          if (!target) return;
          await sock.groupParticipantsUpdate(chat, [target], 'promote');
          await sock.sendMessage(chat, { text: '🎖️ *Rank Elevated*', mentions: [target] });
          break;
        case 'demote':
          if (!target) return;
          await sock.groupParticipantsUpdate(chat, [target], 'demote');
          await sock.sendMessage(chat, { text: '📉 *Rank Stripped*', mentions: [target] });
          break;
      }
    }
  },

  /* -------------------------------------------------------
       PASSIVE MONITOR 1: ANTI-LINK
    ------------------------------------------------------- */
  onMessage: async ({ sock, msg }) => {
    const chat = msg.key.remoteJid;
    if (!antilinkGroups.has(chat)) return;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const sender = msg.key.participant || msg.key.remoteJid;

    if (/chat\.whatsapp\.com\/[a-zA-Z0-9]{10,}/i.test(text)) {
      const { isSenderAdmin, isBotAdmin } = await getGroupPermissions(sock, chat, sender);
      if (isSenderAdmin) return;
      if (isBotAdmin) {
        await sock.sendMessage(chat, { delete: msg.key });
        await sock.sendMessage(chat, { text: `🚫 @${sender.split('@')[0]}, links are forbidden.`, mentions: [sender] });
      }
    }
  },

  /* -------------------------------------------------------
       PASSIVE MONITOR 2: WELCOME / GOODBYE
    ------------------------------------------------------- */
  onGroupUpdate: async ({ sock, update }) => {
    const chat = update.id;
    if (!welcomeGroups.has(chat)) return;

    // Get Group Info
    let meta;
    try { meta = await sock.groupMetadata(chat); } catch { return; }
    const groupName = meta.subject;
    const desc = meta.desc?.toString().slice(0, 100) || 'Welcome to the community!';

    for (const participant of update.participants) {
      // Try to fetch user's profile picture
      let pfp;
      try { pfp = await sock.profilePictureUrl(participant, 'image'); }
      catch { pfp = null; }

      if (update.action === 'add') {
        // WELCOME MESSAGE
        const welcomeText =
          `👋 *Welcome, Traveler!*
────────────────
👤 @${participant.split('@')[0]}
🏰 *${groupName}*
────────────────
📜 *Intel:*
${desc}
────────────────
_Enjoy your stay._`;

        if (pfp) {
          await sock.sendMessage(chat, { image: { url: pfp }, caption: welcomeText, mentions: [participant] });
        } else {
          await sock.sendMessage(chat, { text: welcomeText, mentions: [participant] });
        }
      }
      else if (update.action === 'remove') {
        // GOODBYE MESSAGE
        const byeText = `👋 *Departure Detected*\n\n@${participant.split('@')[0]} has left the void.`;
        await sock.sendMessage(chat, { text: byeText, mentions: [participant] });
      }
    }
  }
};