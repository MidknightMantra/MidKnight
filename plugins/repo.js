import axios from 'axios';
import deluxeUI from '../src/utils/deluxeUI.js';

// Helper function to react
const react = (sock, msg, emoji) => sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });

export default {
  name: 'repo',
  alias: ['sc', 'script', 'source', 'git', 'github'],

  command: {
    pattern: 'repo',
    desc: 'Fetch official source code and repository stats',
    category: 'core',
    react: '💻',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      // ⚙️ CONFIGURATION: Change these to your details if needed
      const githubUser = 'MidknightMantra';
      const githubRepo = 'Midknight';

      try {
        // Show loading state
        await react(sock, msg, '⏳');

        // 1. Fetch Repository Data from GitHub API
        const repoResponse = await axios.get(`https://api.github.com/repos/${githubUser}/${githubRepo}`);
        const data = repoResponse.data;

        // 2. Fetch Latest Release (if any)
        let latestRelease = null;
        try {
          const releaseResponse = await axios.get(`https://api.github.com/repos/${githubUser}/${githubRepo}/releases/latest`);
          latestRelease = releaseResponse.data;
        } catch {
          // No releases yet
        }

        // 3. Fetch Contributors Count
        let contributorsCount = 0;
        try {
          const contributorsResponse = await axios.get(`https://api.github.com/repos/${githubUser}/${githubRepo}/contributors?per_page=1`);
          const linkHeader = contributorsResponse.headers.link;
          if (linkHeader) {
            const match = linkHeader.match(/page=(\d+)>; rel="last"/);
            contributorsCount = match ? parseInt(match[1]) : contributorsResponse.data.length;
          } else {
            contributorsCount = contributorsResponse.data.length;
          }
        } catch {
          contributorsCount = 'N/A';
        }

        // 4. Format Dates
        const createdDate = new Date(data.created_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        const updatedDate = new Date(data.updated_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });

        // 5. Build Stats Object
        const stats = {
          '⭐ *Stars:*': data.stargazers_count.toLocaleString(),
          '🍴 *Forks:*': data.forks_count.toLocaleString(),
          '👁️ *Watchers:*': data.subscribers_count?.toLocaleString() || 'N/A',
          '🐛 *Issues:*': data.open_issues_count.toLocaleString(),
          '👥 *Contributors:*': contributorsCount,
          '📝 *Language:*': data.language || 'Multiple',
          '📜 *License:*': data.license?.name || 'None'
        };

        if (latestRelease) {
          stats['🏷️ *Latest Release:*'] = latestRelease.tag_name;
        }

        stats['📅 *Created:*'] = createdDate;
        stats['🔄 *Updated:*'] = updatedDate;

        // 6. Build the UI using deluxeUI
        const repoText = deluxeUI.info('💻', 'MIDKNIGHT REPOSITORY', stats);

        const footer = `\n\n📝 *Description:*\n${data.description || 'No description provided.'}\n\n🔗 ${data.html_url}`;

        // 7. Send Message with Rich Preview
        await sock.sendMessage(chat, {
          text: repoText + footer,
          contextInfo: {
            externalAdReply: {
              title: `${data.name} v${latestRelease?.tag_name || '2.5.1'}`,
              body: data.description || 'WhatsApp Bot',
              thumbnailUrl: data.owner.avatar_url,
              sourceUrl: data.html_url,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        }, { quoted: msg });

        await react(sock, msg, '✅');

      } catch (error) {
        console.error('Repo Command Error:', error.message);

        await react(sock, msg, '❌');

        // Fallback Static Message with deluxeUI
        const fallbackStats = {
          '👤 *Owner:*': githubUser,
          '🏷️ *Name:*': githubRepo,
          '⭐ *Stars:*': 'Unknown',
          '🍴 *Forks:*': 'Unknown',
          '⚠️ *Status:*': 'API Error / Rate Limited'
        };

        const fallbackText = deluxeUI.info('💻', 'MIDKNIGHT REPOSITORY', fallbackStats);
        const fallbackFooter = `\n\n🔗 https://github.com/${githubUser}/${githubRepo}`;

        await sock.sendMessage(chat, {
          text: fallbackText + fallbackFooter,
          contextInfo: {
            externalAdReply: {
              title: 'Midknight Bot',
              body: 'WhatsApp Automation Platform',
              sourceUrl: `https://github.com/${githubUser}/${githubRepo}`,
              mediaType: 1,
              renderLargerThumbnail: true,
              thumbnailUrl: 'https://i.imgur.com/3LgHj2N.jpeg'
            }
          }
        }, { quoted: msg });
      }
    }
  }
};