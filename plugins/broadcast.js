/* -------------------------------------------------------
   HELPER: Random Jitter (Anti-Ban)
   Waits 2 to 5 seconds between messages
------------------------------------------------------- */
const wait = (min = 2000, max = 5000) =>
  new Promise((res) => setTimeout(res, Math.floor(min + Math.random() * (max - min))));

export default {
  name: 'broadcast',
  alias: ['bc', 'announce', 'transmit'],

  command: {
    pattern: 'broadcast',
    desc: 'Send a message to all active groups',
    category: 'owner',
    react: '📻',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      // 1. Security Check (Owner Only)
      if (!msg.key.fromMe) {
        return sock.sendMessage(chat, { text: '❌ Use your own bot number to broadcast.' }, { quoted: msg });
      }

      // 2. Determine Content (Text vs. Reply)
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const inputText = args.join(' ');

      let content = null;
      let isForward = false;

      if (quoted) {
        // A. Broadcasting a Reply (Media/Sticker/Text)
        // We "Forward" the message to ensure media integrity
        isForward = true;
      } else if (inputText) {
        // B. Broadcasting Text
        content = {
          text: `📻 *SYSTEM BROADCAST*\n\n${inputText}\n\n_© Midknight Systems_`
        };
      } else {
        return sock.sendMessage(chat, {
          text: '📻 *Usage:*\n• Type: `.bc <message>`\n• Or Reply to media with `.bc`'
        }, { quoted: msg });
      }

      // 3. Fetch Targets (Groups Only for Safety)
      // Broadcasting to private chats (contacts) is the #1 way to get banned.
      // We strictly stick to groups here.
      const groups = await sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groups);

      if (groupIds.length === 0) {
        return sock.sendMessage(chat, { text: '⚠️ No active groups found.' });
      }

      // 4. Start Confirmation
      await sock.sendMessage(chat, { text: `📻 *Starting Broadcast*\n\n🎯 Targets: ${groupIds.length} Groups\n⏳ Est. Time: ${Math.ceil((groupIds.length * 3.5) / 60)} mins` });

      // 5. The Loop (With Delays)
      let success = 0;
      let failed = 0;

      for (const jid of groupIds) {
        try {
          // Prevent broadcasting to the status list or the log chat
          if (jid === 'status@broadcast') continue;

          // Send
          if (isForward) {
            // Baileys Forwarding Logic
            // We construct a forward message using the quoted content
            await sock.sendMessage(jid, { forward: { key: { remoteJid: chat, id: contextInfo.stanzaId }, message: quoted } });
          } else {
            await sock.sendMessage(jid, content);
          }

          success++;

          // CRITICAL: Wait before next send
          await wait();

        } catch (e) {
          failed++;
          // Continue loop even if one fails
        }
      }

      // 6. Final Report
      return sock.sendMessage(chat, {
        text: `✅ *Broadcast Complete*\n\nSent: ${success}\nFailed: ${failed}`
      }, { quoted: msg });
    }
  }
};