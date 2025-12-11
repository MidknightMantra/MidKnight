/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Logger
   Clean logging with pino
   ═══════════════════════════════════════════════════════════════ */

import pino from 'pino';
import config from '../config.js';

const logger = pino({
    level: config.debug ? 'debug' : 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss'
        }
    }
});

// Wrapper for consistent logging
export const log = {
    info: (msg, data) => logger.info(data || {}, `⚡ ${msg}`),
    error: (msg, data) => logger.error(data || {}, `❌ ${msg}`),
    warn: (msg, data) => logger.warn(data || {}, `⚠️ ${msg}`),
    debug: (msg, data) => logger.debug(data || {}, `🔍 ${msg}`),
    success: (msg, data) => logger.info(data || {}, `✅ ${msg}`)
};

export default logger;
