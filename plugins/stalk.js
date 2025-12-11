import axios from 'axios';
import { phoneToJid } from '../src/utils/jid.js';

export default {
  name: 'stalk',
  alias: ['whois', 'identify', 'userinfo', 'channel', 'wachannel', 'igstalk', 'insta', 'ig', 'tiktokstalk', 'ttstalk', 'tiktok'],

  command: {
    pattern: 'stalk',
    desc: 'Stalk WhatsApp User, Channel, Instagram, or TikTok',
    category: 'tools',
    react: '👁️',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const cmd = textContent.split(' ')[0].slice(1).toLowerCase();

      // TIKTOK STALKING MODE
      if (cmd === 'tiktokstalk' || cmd === 'ttstalk' || cmd === 'tiktok') {
        const username = args[0];
        if (!username) return sock.sendMessage(chat, { text: '🎵 *Usage:* `.tiktokstalk <username>`' }, { quoted: msg });

        try {
          await sock.sendMessage(chat, { react: { text: '🎵', key: msg.key } });
          const apiUrl = `https://api.giftedtech.co.ke/api/stalk/tiktokstalk?apikey=gifted&username=${encodeURIComponent(username)}`;
          const { data } = await axios.get(apiUrl);
          const res = data.result || data;

          if (!res) throw new Error('No data');

          const report = `╭━━━『 🎵 MIDKNIGHT TIKTOK 』━━━╮
┃
┃ 👤 *Name:* ${res.name || res.nickname || 'Unknown'}
┃ 🏷️ *User:* @${res.username || username}
┃ 👥 *Followers:* ${res.followers || res.followerCount || '0'}
┃ 👣 *Following:* ${res.following || res.followingCount || '0'}
┃ ❤️ *Likes:* ${res.likes || res.heartCount || '0'}
┃ 📝 *Bio:* ${(res.description || res.desc || res.signature || '').substring(0, 100) || 'None'}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Make every second count.”_`;

          const img = res.profile || res.avatar || res.profile_picture;
          if (img) {
            await sock.sendMessage(chat, { image: { url: img }, caption: report }, { quoted: msg });
          } else {
            await sock.sendMessage(chat, { text: report }, { quoted: msg });
          }
          return;

        } catch (e) {
          return sock.sendMessage(chat, { text: '❌ Failed to fetch TikTok info.' }, { quoted: msg });
        }
      }

      // INSTAGRAM STALKING MODE
      if (cmd === 'igstalk' || cmd === 'insta' || cmd === 'ig') {
        const username = args[0];
        if (!username) return sock.sendMessage(chat, { text: '📸 *Usage:* `.igstalk <username>`' }, { quoted: msg });

        try {
          await sock.sendMessage(chat, { react: { text: '📸', key: msg.key } });
          const apiUrl = `https://api.giftedtech.co.ke/api/stalk/igstalk?apikey=gifted&username=${encodeURIComponent(username)}`;
          const { data } = await axios.get(apiUrl);
          const res = data.result || data;

          if (!res) throw new Error('No data');

          const report = `╭━━━『 📸 MIDKNIGHT INSTAGRAM 』━━━╮
┃
┃ 👤 *Name:* ${res.full_name || res.fullname || res.username || 'Unknown'}
┃ 🏷️ *User:* @${res.username || username}
┃ 👥 *Followers:* ${res.followers || res.follower_count || res.edge_followed_by?.count || '0'}
┃ 👣 *Following:* ${res.following || res.following_count || res.edge_follow?.count || '0'}
┃ 📝 *Bio:* ${(res.biography || res.bio || '').substring(0, 100) || 'None'}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Social footprint.”_`;

          const img = res.profile_pic_url || res.hd_profile_pic_url_info?.url || res.profile_pic_url_hd;
          if (img) {
            await sock.sendMessage(chat, { image: { url: img }, caption: report }, { quoted: msg });
          } else {
            await sock.sendMessage(chat, { text: report }, { quoted: msg });
          }
          return;

        } catch (e) {
          return sock.sendMessage(chat, { text: '❌ Failed to fetch Instagram info.' }, { quoted: msg });
        }
      }

      // CHANNEL STALKING MODE
      if (cmd === 'channel' || cmd === 'wachannel') {
        const url = args.join(' ');
        if (!url) return sock.sendMessage(chat, { text: '👁️ *Usage:* `.channel <link>`' }, { quoted: msg });

        try {
          await sock.sendMessage(chat, { react: { text: '📡', key: msg.key } });
          const apiUrl = `https://api.giftedtech.co.ke/api/stalk/wachannel?apikey=gifted&url=${encodeURIComponent(url)}`;
          const { data } = await axios.get(apiUrl);
          const res = data.result || data;

          if (!res) throw new Error('No data');

          const report = `╭━━━『 📡 MIDKNIGHT CHANNEL 』━━━╮
┃
┃ 📢 *Name:* ${res.title || res.name || res.channelName || 'Unknown'}
┃ 👥 *Followers:* ${res.followers || res.subscriberCount || res.size || '0'}
┃ 📝 *Desc:* ${(res.description || res.desc || '').substring(0, 100) || 'None'}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Broadcast yourself.”_`;

          const img = res.img || res.image || res.profile_picture;
          if (img) {
            await sock.sendMessage(chat, { image: { url: img }, caption: report }, { quoted: msg });
          } else {
            await sock.sendMessage(chat, { text: report }, { quoted: msg });
          }
          return;

        } catch (e) {
          return sock.sendMessage(chat, { text: '❌ Failed to fetch channel info.' }, { quoted: msg });
        }
      }

      // USER STALKING MODE (Existing Logic)
      let target = '';

      // 1. Determine Target
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      if (quoted?.participant) {
        target = quoted.participant;
      } else if (quoted?.mentionedJid && quoted.mentionedJid.length > 0) {
        target = quoted.mentionedJid[0];
      } else if (args.length > 0) {
        target = phoneToJid(args[0]);
      } else {
        return sock.sendMessage(chat, {
          text: '👁️ *Midknight Stalker*\n\nUsage:\nReply to a message with `.stalk`\nOr use `.channel <link>`\nOr use `.igstalk <username>`\nOr use `.tiktokstalk <username>`'
        }, { quoted: msg });
      }

      try { await sock.sendMessage(chat, { react: { text: '💾', key: msg.key } }); } catch { }

      // 2. DATA MINING: WhatsApp Internal Data
      const cleanNum = target.split('@')[0];

      // A. Profile Picture (High Res)
      let pfp = null;
      try { pfp = await sock.profilePictureUrl(target, 'image'); } catch { }

      // B. Status / Bio
      let bio = '🔒 Private / None';
      let bioDate = '';
      try {
        const statusData = await sock.fetchStatus(target);
        bio = statusData.status || 'No Bio';
        bioDate = statusData.setAt ? new Date(statusData.setAt).toLocaleDateString() : '';
      } catch { }

      // C. Business Profile (Deep Dive)
      let businessInfo = '';
      try {
        // Check if business
        const biz = await sock.getBusinessProfile(target);
        if (biz) {
          businessInfo += '\n🏢 *Business Info:*';
          if (biz.description) businessInfo += `\n📝 ${biz.description}`;
          if (biz.website && biz.website.length > 0) businessInfo += `\n🔗 ${biz.website[0]}`;
          if (biz.email) businessInfo += `\n📧 ${biz.email}`;
          if (biz.address) businessInfo += `\n📍 ${biz.address}`;
        }
      } catch {
        // Not a business account, ignore
      }

      // D. User's PushName (The name they set for themselves)
      // We try to fetch it from the contact store or the message itself if replying
      let username = 'Unknown';
      if (quoted && quoted.pushName) {
        username = quoted.pushName;
      }
      // If we can't find it, we leave it as "Unknown"

      // 3. Construct the Report
      const tcLink = `https://www.truecaller.com/search/global/${cleanNum}`;
      const waLink = `https://wa.me/${cleanNum}`;

      const report =
        `👁️ *IDENTITY RECORD*
────────────────
👤 *User:* +${cleanNum}
🏷️ *App Username:* ${username}
📝 *Bio:* ${bio} ${bioDate ? `(${bioDate})` : ''}
────────────────${businessInfo}
────────────────
🔗 *Quick Links:*
🔎 [Truecaller Check](${tcLink})
💬 [Direct Message](${waLink})`;

      // 4. Send Result
      if (pfp) {
        await sock.sendMessage(chat, { image: { url: pfp }, caption: report }, { quoted: msg });
      } else {
        await sock.sendMessage(chat, { text: report }, { quoted: msg });
      }

      try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }
    }
  }
};