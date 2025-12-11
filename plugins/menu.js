/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT MENU - Premium Command Dashboard
   A unique, modern menu design
   ═══════════════════════════════════════════════════════════════ */

// Category Icons (unique design)
const CATS = {
  core: { icon: '⚡', name: 'CORE' },
  ai: { icon: '🧠', name: 'ARTIFICIAL INTEL' },
  downloader: { icon: '📥', name: 'DOWNLOADS' },
  media: { icon: '🎨', name: 'MEDIA TOOLS' },
  search: { icon: '🔍', name: 'SEARCH' },
  tools: { icon: '🛠️', name: 'UTILITIES' },
  group: { icon: '👥', name: 'GROUP ADMIN' },
  admin: { icon: '🔐', name: 'BOT ADMIN' },
  fun: { icon: '🎮', name: 'ENTERTAINMENT' },
  settings: { icon: '⚙️', name: 'SETTINGS' },
  others: { icon: '📦', name: 'MISC' }
};

function getUptime() {
  const s = Math.floor(process.uptime());
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default {
  name: 'menu',
  alias: ['help', 'commands', 'list', 'cmds'],
  desc: 'Display command dashboard',
  category: 'core',
  react: '📋',

  command: {
    pattern: 'menu',
    run: async ({ sock, msg, args, config }) => {
      const chat = msg.key.remoteJid;
      const user = msg.pushName || 'User';
      const prefix = config?.prefix || '.';

      await sock.sendPresenceUpdate('composing', chat);

      // Get all commands from plugin manager
      const pm = global.MIDKNIGHT?.pluginManager || global.MIDKNIGHT?.pluginManager;
      if (!pm) {
        return sock.sendMessage(chat, { text: '❌ System loading...' }, { quoted: msg });
      }

      // Collect commands by category
      const categories = {};
      let totalCmds = 0;

      pm.plugins.forEach(p => {
        const pattern = p.pattern;
        if (!pattern || p.enabled === false) return;

        const cat = p.category || 'others';
        if (!categories[cat]) categories[cat] = [];

        const cmd = Array.isArray(pattern) ? pattern[0] : pattern;
        categories[cat].push(cmd);
        totalCmds++;
      });

      // Build sleek menu
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      let menu = `
╭─────────────────────╮
│    🌙 MIDKNIGHT 🌙    │
╰─────────────────────╯

┌─[ 📊 *DASHBOARD* ]
│ 
│ 👤 User: *${user}*
│ ⏰ Time: ${time}
│ 📅 Date: ${date}
│ ⚡ Uptime: ${getUptime()}
│ 📦 Commands: ${totalCmds}
│ 
└───────────────────

`;

      // Priority order for categories
      const order = ['core', 'ai', 'downloader', 'media', 'search', 'tools', 'group', 'admin', 'fun', 'settings', 'others'];

      for (const catKey of order) {
        if (!categories[catKey] || categories[catKey].length === 0) continue;

        const cat = CATS[catKey] || { icon: '📦', name: catKey.toUpperCase() };
        const cmds = categories[catKey].sort();

        menu += `┌─[ ${cat.icon} *${cat.name}* ]
│
`;
        // Display commands in a clean grid
        const cmdList = cmds.map(c => `│ ▸ ${prefix}${c}`).join('\n');
        menu += cmdList + '\n│\n└───────────────────\n\n';
      }

      menu += `╭─────────────────────╮
│  🌙 𝙼𝙸𝙳𝙺𝙽𝙸𝙶𝙷𝚃 𝚟𝟷.𝟶  │
╰─────────────────────╯

_Type ${prefix}help <cmd> for details_`;

      // Send with rich preview
      await sock.sendMessage(chat, {
        text: menu,
        contextInfo: {
          externalAdReply: {
            title: 'MIDKNIGHT - Her Command Center',
            body: `${totalCmds} commands available`,
            thumbnailUrl: config.botLogo,
            sourceUrl: 'https://github.com/MidknightMantra/Midknight',
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg });

      await sock.sendPresenceUpdate('paused', chat);
    }
  }
};
