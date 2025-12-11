/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Deluxe UI Utilities
   Rich text formatting for WhatsApp messages
   ═══════════════════════════════════════════════════════════════ */

/**
 * Create a styled header box
 * @param {string} title - Header title
 * @param {string} emoji - Optional emoji
 * @returns {string} Formatted header
 */
export function header(title, emoji = '✦') {
    return `╭─────────────────────╮
│   ${emoji} *${title}* ${emoji}   │
╰─────────────────────╯`;
}

/**
 * Create a section with title and content
 * @param {string} title - Section title
 * @param {string} content - Section content
 * @param {string} emoji - Optional emoji
 * @returns {string} Formatted section
 */
export function section(title, content, emoji = '📌') {
    return `┌─[ ${emoji} *${title}* ]
│
${content.split('\n').map(line => `│ ${line}`).join('\n')}
│
└───────────────────`;
}

/**
 * Create a simple box around text
 * @param {string} text - Text to box
 * @returns {string} Boxed text
 */
export function box(text) {
    return `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰
${text}
▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰`;
}

/**
 * Format key-value pairs as a list
 * @param {Object} data - Key-value pairs
 * @returns {string} Formatted list
 */
export function list(data) {
    return Object.entries(data)
        .map(([key, value]) => `│ *${key}:* ${value}`)
        .join('\n');
}

/**
 * Create a progress bar
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {number} length - Bar length
 * @returns {string} Progress bar
 */
export function progressBar(current, total, length = 10) {
    const filled = Math.round((current / total) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round((current / total) * 100)}%`;
}

/**
 * Format duration from seconds
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * Format bytes to human readable
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Error message format
 * @param {string} message - Error message
 * @returns {string} Formatted error
 */
export function error(message) {
    return `❌ *Error*\n${message}`;
}

/**
 * Success message format
 * @param {string} message - Success message
 * @returns {string} Formatted success
 */
export function success(message) {
    return `✅ *Success*\n${message}`;
}

/**
 * Warning message format
 * @param {string} message - Warning message
 * @returns {string} Formatted warning
 */
export function warning(message) {
    return `⚠️ *Warning*\n${message}`;
}

export default {
    header,
    section,
    box,
    list,
    progressBar,
    formatDuration,
    formatBytes,
    error,
    success,
    warning
};
