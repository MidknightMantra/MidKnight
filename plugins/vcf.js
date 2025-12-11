import fs from 'fs';

export default {
  name: 'vcf',
  alias: ['contacts', 'dump'],

  command: {
    pattern: 'vcf',
    desc: 'Generate contact files (Uses WhatsApp Name if available)',
    category: 'tools',
    react: '📇',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const isGroup = chat.endsWith('@g.us');

      /* =======================================================
         MODE 1: SAVE SINGLE USER (Reply)
         Uses the exact PushName found in the message context
      ======================================================= */
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      const target = quoted?.participant || quoted?.mentionedJid?.[0];

      if (target) {
        const cleanNum = target.split('@')[0];

        // PRIORITY: PushName -> VerifiedName -> Phone Number
        const name = quoted?.pushName || quoted?.verifiedName || `+${cleanNum}`;

        // VCard 3.0 Format
        const vcard =
          'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          `FN:${name}\n` +
          `TEL;type=CELL;type=VOICE;waid=${cleanNum}:+${cleanNum}\n` +
          'END:VCARD';

        await sock.sendMessage(chat, {
          contacts: {
            displayName: name,
            contacts: [{ vcard }]
          }
        }, { quoted: msg });

        return;
      }

      /* =======================================================
         MODE 2: GROUP DUMP (All Members)
      ======================================================= */
      if (!isGroup) {
        return await sock.sendMessage(chat, { text: '❌ Use this in a group.' }, { quoted: msg });
      }

      try { await sock.sendMessage(chat, { react: { text: '💾', key: msg.key } }); } catch { }
      const loadingMsg = await sock.sendMessage(chat, { text: '📇 *Harvesting contact data...*' }, { quoted: msg });

      try {
        // 2. Fetch Metadata
        const meta = await sock.groupMetadata(chat);
        const participants = meta.participants;
        const groupName = meta.subject;

        // 3. Build VCF Content
        let vcfContent = '';

        participants.forEach((p) => {
          const num = p.id.split('@')[0];

          // LOGIC:
          // We can't fetch the PushName for 500 people instantly without getting banned.
          // So we use the Phone Number as the Name. 
          // This is cleaner than "Group - Number".
          // If you have a store attached, we try to grab the name from there.

          let name = `+${num}`;

          // If your bot has a store (advanced), we check it here:
          if (sock.store && sock.store.contacts[p.id] && sock.store.contacts[p.id].name) {
            name = sock.store.contacts[p.id].name;
          }

          vcfContent +=
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${name}\n` +
            `TEL;type=CELL;type=VOICE;waid=${num}:+${num}\n` +
            'END:VCARD\n';
        });

        // 4. Send Document
        const buffer = Buffer.from(vcfContent, 'utf-8');
        const fileName = `${groupName.replace(/[^a-zA-Z0-9 ]/g, '')}_Contacts.vcf`;

        await sock.sendMessage(chat, {
          document: buffer,
          mimetype: 'text/vcard',
          fileName: fileName,
          caption: `📇 *Identity Grid Generated*\n\n👥 *Contacts:* ${participants.length}\n📂 *Format:* VCard 3.0`
        }, { quoted: msg });

        try { await sock.sendMessage(chat, { delete: loadingMsg.key }); } catch { }
        try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

      } catch (e) {
        console.error('VCF Error:', e);
        await sock.sendMessage(chat, { text: '❌ Failed to compile contacts.' }, { quoted: msg });
      }
    }
  }
};