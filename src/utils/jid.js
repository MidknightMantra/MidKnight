/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - JID Utilities
   Helper functions for WhatsApp JID manipulation
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get the bot's JID from the socket connection
 * @param {object} sock - Baileys socket connection
 * @returns {string} Bot's JID
 */
export function getBotJid(sock) {
    return sock.user?.id?.replace(/:.*@/, '@') || sock.user?.id;
}

/**
 * Convert a phone number to WhatsApp JID format
 * @param {string} phone - Phone number (with or without country code)
 * @returns {string} WhatsApp JID
 */
export function phoneToJid(phone) {
    if (!phone) return null;
    // Remove all non-numeric characters
    let cleaned = phone.toString().replace(/[^0-9]/g, '');
    // If starts with 0, assume local number - you may want to add country code logic
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.slice(1); // Default to Kenya, adjust as needed
    }
    return `${cleaned}@s.whatsapp.net`;
}

/**
 * Extract phone number from JID
 * @param {string} jid - WhatsApp JID
 * @returns {string} Phone number
 */
export function jidToPhone(jid) {
    if (!jid) return null;
    return jid.split('@')[0].split(':')[0];
}

/**
 * Check if JID is a group
 * @param {string} jid - WhatsApp JID
 * @returns {boolean}
 */
export function isGroup(jid) {
    return jid?.endsWith('@g.us');
}

/**
 * Check if JID is a status broadcast
 * @param {string} jid - WhatsApp JID
 * @returns {boolean}
 */
export function isStatus(jid) {
    return jid === 'status@broadcast';
}

/**
 * Normalize JID (remove device suffix)
 * @param {string} jid - WhatsApp JID
 * @returns {string} Normalized JID
 */
export function normalizeJid(jid) {
    if (!jid) return null;
    return jid.replace(/:.*@/, '@');
}

export default {
    getBotJid,
    phoneToJid,
    jidToPhone,
    isGroup,
    isStatus,
    normalizeJid
};
