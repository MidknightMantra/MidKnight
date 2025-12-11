import { getBotJid, phoneToJid } from '../src/utils/jid.js';
import fs from 'fs';
import path from 'path';

/* -------------------------------------------------------
   WARNINGS SYSTEM (In-Memory)
------------------------------------------------------- */
const warnings = new Map(); // Structure: group_user => [{ reason, date }, ...]

function addWarning(groupId, userId, reason) {
  const key = `${groupId}_${userId}`;
  const current = warnings.get(key) || [];
  current.push({ reason, date: new Date().toISOString() });
  warnings.set(key, current);
  return current.length;
}

function getWarnings(groupId, userId) {
  return warnings.get(`${groupId}_${userId}`) || [];
}

function clearWarnings(groupId, userId) {
  warnings.delete(`${groupId}_${userId}`);
}

/* -------------------------------------------------------
   HELPER: Get Permissions
------------------------------------------------------- */
async function getGroupPermissions(sock, chat, authorId) {
  try {
    const meta = await sock.groupMetadata(chat);

    // Normalize JIDs for comparison (remove device suffix :XX)
    const normalizeJid = (jid) => jid?.replace(/:.*@/, '@');
    const groupAdmins = meta.participants
      .filter(p => p.admin !== null)
      .map(p => normalizeJid(p.id));

    const botId = normalizeJid(getBotJid(sock));
    const isBotAdmin = groupAdmins.includes(botId);
    const isSenderAdmin = groupAdmins.includes(normalizeJid(authorId));

    // DEBUG LOGGING
    console.log('🔍 Admin Check Debug:');
    console.log('Bot JID:', botId);
    console.log('Group Admins:', groupAdmins);
    console.log('Is Bot Admin?', isBotAdmin);

    return { isBotAdmin, isSenderAdmin, participants: meta.participants, meta };
  } catch (e) {
    console.error('Admin check error:', e);
    return { isBotAdmin: false, isSenderAdmin: false, participants: [], meta: null };
  }
}

export default {
  name: 'admin',
  alias: [
    'kick', 'ban', 'remove',
    'add',
    'promote', 'demote',
    'mute', 'unmute',
    'open', 'close',
    'revoke', 'resetlink',
    'setname', 'setdesc',
    'hidetag', 'tagall', 'everyone',
    'warn', 'warnings', 'unwarn',
    'ginfo', 'groupinfo',
    'delete', 'del',
    'link', 'invite'
  ],

  command: {
    pattern: 'admin',
    desc: 'Complete Group Administration Suite',
    category: 'admin',
    react: '👮',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;

      // 1. Group Check (except for some commands that might work in DM)
      const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      let command = textContent.split(' ')[0].slice(1).toLowerCase();

      if (command === 'admin') {
        if (!args[0]) {
          return sock.sendMessage(chat, {
            text: `👮 *MIDKNIGHT ADMIN SUITE*
            
*Moderation:*
• .kick @user
• .add <number>
• .promote @user
• .demote @user
• .warn @user [reason]
• .warnings @user
• .unwarn @user

*Group Settings:*
• .mute / .unmute
• .open / .close
• .revoke / .link
• .setname <name>
• .setdesc <desc>

*Info:*
• .ginfo (group stats)

*Announcements:*
• .tagall <msg>
• .hidetag <msg>
• .delete (reply to msg)`
          }, { quoted: msg });
        }
        command = args[0].toLowerCase();
        args.shift();
      }

      // Allow ginfo and link without group check
      if (!['ginfo', 'groupinfo'].includes(command) && !chat.endsWith('@g.us')) {
        return await sock.sendMessage(chat, { text: '❌ This command is for groups only.' }, { quoted: msg });
      }

      // 3. Permission Check (skip for ginfo)
      const { isBotAdmin, isSenderAdmin, participants, meta } = await getGroupPermissions(sock, chat, sender);

      if (!['ginfo', 'groupinfo'].includes(command) && !isSenderAdmin) {
        return await sock.sendMessage(chat, { text: '⚠️ *Access Denied:* You are not an admin.' }, { quoted: msg });
      }

      if (!['ginfo', 'groupinfo', 'link', 'invite'].includes(command) && !isBotAdmin) {
        return await sock.sendMessage(chat, { text: '⚠️ *System Error:* I need Admin privileges to proceed.' }, { quoted: msg });
      }

      // 4. Target Resolution
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      let target = quoted?.participant || quoted?.mentionedJid?.[0];

      if (!target && args[0]) {
        const potentialNum = args[0].replace(/[^0-9]/g, '');
        if (potentialNum.length > 6) {
          target = phoneToJid(potentialNum);
        }
      }

      /* =======================================================
               EXECUTION LOGIC
      ======================================================= */

      try {
        switch (command) {
          // --- MODERATION ---
          case 'kick':
          case 'ban':
          case 'remove':
            if (!target) return sock.sendMessage(chat, { text: '❌ Reply to a user or tag them to kick.' }, { quoted: msg });
            if (target === sender) return sock.sendMessage(chat, { text: '❌ You cannot kick yourself.' }, { quoted: msg });
            await sock.groupParticipantsUpdate(chat, [target], 'remove');
            await sock.sendMessage(chat, { text: `🚫 *User Removed*\n✅ Action completed`, mentions: [target] });
            break;

          case 'add':
            if (!args[0]) return sock.sendMessage(chat, { text: '❌ Provide a number to add.' }, { quoted: msg });
            const num = args[0].replace(/[^0-9]/g, '');
            const targetAdd = phoneToJid(num);
            try {
              await sock.groupParticipantsUpdate(chat, [targetAdd], 'add');
              await sock.sendMessage(chat, { text: '✅ *User Added*', mentions: [targetAdd] });
            } catch (e) {
              await sock.sendMessage(chat, { text: `❌ Failed to add user. They may have privacy settings enabled.` }, { quoted: msg });
            }
            break;

          case 'promote':
            if (!target) return sock.sendMessage(chat, { text: '❌ Reply to a user or tag them to promote.' }, { quoted: msg });
            await sock.groupParticipantsUpdate(chat, [target], 'promote');
            await sock.sendMessage(chat, { text: '🎖️ *Rank Elevated*\nUser is now an Admin.', mentions: [target] });
            break;

          case 'demote':
            if (!target) return sock.sendMessage(chat, { text: '❌ Reply to a user or tag them to demote.' }, { quoted: msg });
            await sock.groupParticipantsUpdate(chat, [target], 'demote');
            await sock.sendMessage(chat, { text: '📉 *Rank Stripped*\nUser is no longer an Admin.', mentions: [target] });
            break;

          // --- WARNINGS SYSTEM ---
          case 'warn':
            if (!target) return sock.sendMessage(chat, { text: '❌ Reply to a user or tag them to warn.' }, { quoted: msg });
            const warnReason = args.slice(1).join(' ') || 'No reason specified';
            const warnCount = addWarning(chat, target, warnReason);
            await sock.sendMessage(chat, {
              text: `⚠️ *USER WARNED*\n\n` +
                `📌 Reason: ${warnReason}\n` +
                `🔢 Total Warnings: ${warnCount}/3\n\n` +
                `${warnCount >= 3 ? '🚨 *Maximum warnings reached! Consider action.*' : ''}`,
              mentions: [target]
            });
            break;

          case 'warnings':
            if (!target) return sock.sendMessage(chat, { text: '❌ Reply to a user or tag them to check warnings.' }, { quoted: msg });
            const userWarnings = getWarnings(chat, target);
            if (userWarnings.length === 0) {
              return sock.sendMessage(chat, { text: '✅ User has no warnings.', mentions: [target] });
            }
            let warnText = `⚠️ *WARNINGS FOR USER*\n\nTotal: ${userWarnings.length}\n\n`;
            userWarnings.forEach((w, i) => {
              warnText += `${i + 1}. ${w.reason}\n   📅 ${new Date(w.date).toLocaleString()}\n\n`;
            });
            await sock.sendMessage(chat, { text: warnText, mentions: [target] });
            break;

          case 'unwarn':
            if (!target) return sock.sendMessage(chat, { text: '❌ Reply to a user or tag them to clear warnings.' }, { quoted: msg });
            clearWarnings(chat, target);
            await sock.sendMessage(chat, { text: '✅ *Warnings Cleared*', mentions: [target] });
            break;

          // --- SETTINGS ---
          case 'mute':
            await sock.groupSettingUpdate(chat, 'announcement');
            await sock.sendMessage(chat, { text: '🔇 *Chat Muted*\nOnly admins can send messages.' });
            break;

          case 'unmute':
            await sock.groupSettingUpdate(chat, 'not_announcement');
            await sock.sendMessage(chat, { text: '🔊 *Chat Unmuted*\nAll participants can send messages.' });
            break;

          case 'close':
            await sock.groupSettingUpdate(chat, 'locked');
            await sock.sendMessage(chat, { text: '🔒 *Group Settings Locked*\nOnly admins can edit info.' });
            break;

          case 'open':
            await sock.groupSettingUpdate(chat, 'unlocked');
            await sock.sendMessage(chat, { text: '🔓 *Group Settings Unlocked*\nEveryone can edit info.' });
            break;

          case 'revoke':
          case 'resetlink':
            await sock.groupRevokeInvite(chat);
            await sock.sendMessage(chat, { text: '🔗 *Invite Link Reset*\nThe previous link is now invalid.' });
            break;

          case 'link':
          case 'invite':
            try {
              const code = await sock.groupInviteCode(chat);
              await sock.sendMessage(chat, { text: `🔗 *GROUP INVITE LINK*\n\nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
            } catch (e) {
              await sock.sendMessage(chat, { text: '❌ Failed to get invite link. Bot needs admin privileges.' }, { quoted: msg });
            }
            break;

          case 'setname':
            const newName = args.join(' ');
            if (!newName) return sock.sendMessage(chat, { text: '❌ Provide a new name.' }, { quoted: msg });
            await sock.groupUpdateSubject(chat, newName);
            await sock.sendMessage(chat, { text: `🏷️ *Group Name Updated*\n\n"${newName}"` });
            break;

          case 'setdesc':
            const newDesc = args.join(' ');
            if (!newDesc) return sock.sendMessage(chat, { text: '❌ Provide a new description.' }, { quoted: msg });
            await sock.groupUpdateDescription(chat, newDesc);
            await sock.sendMessage(chat, { text: '📝 *Group Description Updated*' });
            break;

          // --- DELETE MESSAGE ---
          case 'delete':
          case 'del':
            if (!quoted?.stanzaId) return sock.sendMessage(chat, { text: '❌ Reply to a message to delete it.' }, { quoted: msg });
            await sock.sendMessage(chat, { delete: { remoteJid: chat, fromMe: false, id: quoted.stanzaId, participant: quoted.participant } });
            break;

          // --- GROUP INFO ---
          case 'ginfo':
          case 'groupinfo':
            if (!meta) return sock.sendMessage(chat, { text: '❌ Failed to fetch group info.' }, { quoted: msg });
            const admins = participants.filter(p => p.admin !== null);
            const infoText = `📊 *GROUP INFORMATION*\n\n` +
              `📛 Name: ${meta.subject}\n` +
              `🆔 ID: ${meta.id}\n` +
              `👥 Members: ${participants.length}\n` +
              `👮 Admins: ${admins.length}\n` +
              `📅 Created: ${new Date(meta.creation * 1000).toDateString()}\n` +
              `📝 Description:\n${meta.desc || 'None'}`;
            await sock.sendMessage(chat, { text: infoText }, { quoted: msg });
            break;

          // --- ANNOUNCEMENTS ---
          case 'tagall':
          case 'everyone':
            const tagMsg = args.join(' ') || '⚠️ *Admin Alert*';
            let mentions = participants.map(p => p.id);
            let tagText = `📣 *TAG ALL*\n\n${tagMsg}\n\n`;
            for (let p of participants) {
              tagText += `➥ @${p.id.split('@')[0]}\n`;
            }
            await sock.sendMessage(chat, { text: tagText, mentions: mentions }, { quoted: msg });
            break;

          case 'hidetag':
            const hidetagMsg = args.join(' ') || '⚠️ *Admin Alert*';
            await sock.sendMessage(chat, {
              text: hidetagMsg,
              mentions: participants.map(p => p.id)
            }, { quoted: msg });
            break;

          default:
            return sock.sendMessage(chat, { text: '❌ Unknown admin command. Use `.admin` for help.' }, { quoted: msg });
        }
      } catch (error) {
        console.error('Admin command error:', error);
        await sock.sendMessage(chat, { text: `❌ *Error:* ${error.message}` }, { quoted: msg });
      }
    }
  }
};
