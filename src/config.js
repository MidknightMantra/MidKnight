/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Configuration
   Centralized bot configuration from environment variables
   ═══════════════════════════════════════════════════════════════ */

import { safeParseConfig } from './validators/configSchema.js';

/**
 * Parse environment variables into raw config object
 * @returns {object} Raw configuration from environment
 */
function parseEnvConfig() {
  return {
    // Bot Identity
    botName: process.env.BOT_NAME,
    botLogo: process.env.BOT_LOGO || 'https://files.catbox.moe/ruaavp.jpg',
    prefix: process.env.PREFIX,

    // Session
    sessionId: process.env.SESSION_ID,
    sessionDir: './session',

    // Owner (comma-separated for multiple)
    ownerNumber: process.env.OWNER_NUMBER?.split(',').map(n => n.trim()),

    // Features
    autoRead: process.env.AUTO_READ === 'true',
    autoTyping: process.env.AUTO_TYPING !== 'false', // default true
    autoReact: process.env.AUTO_REACT !== 'false',   // default true

    // Anti-features defaults
    antiCall: process.env.ANTI_CALL === 'true',

    // Limits
    maxDownloadSize: process.env.MAX_DOWNLOAD_SIZE
      ? parseInt(process.env.MAX_DOWNLOAD_SIZE)
      : undefined,

    // Bot mode: public, private, groups
    mode: process.env.BOT_MODE,

    // Debug
    debug: process.env.DEBUG === 'true',

    // Process self messages
    processSelfMessages: process.env.PROCESS_SELF_MESSAGES === 'true',

    // Auto-Join / Auto-Follow
    autoJoinGroupUrl: process.env.AUTO_JOIN_GROUP || 'https://chat.whatsapp.com/JBNW9T9VimjDxa8rD5rKfc',
    autoFollowChannelUrl: process.env.AUTO_FOLLOW_CHANNEL || 'https://www.whatsapp.com/channel/0029VbBs1ph6RGJIhteNql3r'
  };
}

// Parse and validate configuration
const rawConfig = parseEnvConfig();
const config = safeParseConfig(rawConfig);

export default config;
