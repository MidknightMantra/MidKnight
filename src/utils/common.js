/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Common Utilities
   Shared helper functions required by various plugins
   ═══════════════════════════════════════════════════════════════ */

import axios from 'axios';

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const delay = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Alias for delay
 */
export const sleep = delay;

/**
 * Pick a random item from an array
 * @param {Array} arr - Array to pick from
 * @returns {*} Random item
 */
export function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get random integer between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function getRandom(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fetch JSON from URL
 * @param {string} url - URL to fetch
 * @param {object} options - Axios options
 * @returns {Promise<object>} JSON data
 */
export async function fetchJson(url, options) {
    try {
        const res = await axios.get(url, { ...options });
        return res.data;
    } catch (err) {
        return null;
    }
}

/**
 * Convert buffer to JSON
 * @param {Buffer} buffer - Buffer to convert
 * @returns {object} JSON object
 */
export function bufferToJson(buffer) {
    try {
        return JSON.parse(buffer.toString('utf-8'));
    } catch {
        return {};
    }
}

/**
 * Check if string is a valid URL
 * @param {string} string - String to check
 * @returns {boolean}
 */
export function isUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Runtime stats helper
 * @param {number} seconds - Uptime in seconds
 * @returns {object} Formatted time object
 */
export function runtime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

export default {
    delay,
    sleep,
    pickRandom,
    getRandom,
    fetchJson,
    bufferToJson,
    isUrl,
    runtime
};
