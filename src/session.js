/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Session Manager
   Handles session restoration from Midknight~CODE format
   ═══════════════════════════════════════════════════════════════ */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import config from './config.js';
import { log } from './utils/logger.js';
import { encrypt, decrypt, isEncrypted } from './security/encryption.js';
import { getEncryptionSettings } from './security/keyManager.js';

const SESSION_DIR = config.sessionDir;

/**
 * Parse session ID to extract Pastebin code
 * Format: Midknight~PASTEBIN_CODE or just SESSION_ID for legacy
 * @param {string} sessionId - Session ID string
 * @returns {object} { type: 'pastebin'|'legacy', code: string }
 */
export function parseSessionId(sessionId) {
    if (!sessionId) return null;

    // Check for Midknight~ prefix format
    if (sessionId.includes('~')) {
        const [prefix, code] = sessionId.split('~');
        return { type: 'pastebin', code: code.trim(), prefix };
    }

    // Legacy: treat as direct Pastebin code
    return { type: 'pastebin', code: sessionId.trim(), prefix: null };
}

/**
 * Download session credentials from Pastebin
 * @param {string} code - Pastebin paste code
 * @returns {Promise<object|null>} Credentials object or null
 */
export async function downloadFromPastebin(code) {
    try {
        // Pastebin raw URL format
        const url = `https://pastebin.com/raw/${code}`;
        log.info(`Downloading session from: ${url}`);

        const { data } = await axios.get(url, { timeout: 30000 });

        // The data should be the creds.json content
        // It might be base64 encoded or raw JSON
        let creds;

        if (typeof data === 'string') {
            try {
                // Try parsing as JSON first
                creds = JSON.parse(data);
            } catch {
                // Try base64 decode
                try {
                    const decoded = Buffer.from(data, 'base64').toString('utf-8');
                    creds = JSON.parse(decoded);
                } catch {
                    log.error('Could not parse session data');
                    return null;
                }
            }
        } else {
            creds = data;
        }

        return creds;
    } catch (error) {
        log.error('Failed to download session', { error: error.message });
        return null;
    }
}

/**
 * Save credentials to file (with optional encryption)
 * @param {object} creds - Credentials to save
 * @param {string} path - File path
 */
export function saveCredentials(creds, path) {
    const encryptionSettings = getEncryptionSettings();

    if (encryptionSettings.enabled) {
        log.info('Encrypting session before saving...');
        const encrypted = encrypt(creds, encryptionSettings.key);
        writeFileSync(path, JSON.stringify(encrypted, null, 2));
        log.info('Session encrypted and saved');
    } else {
        writeFileSync(path, JSON.stringify(creds, null, 2));
    }
}

/**
 * Load credentials from file (with automatic decryption)
 * @param {string} path - File path
 * @returns {object|null} Credentials or null if not found
 */
export function loadCredentials(path) {
    if (!existsSync(path)) {
        return null;
    }

    try {
        const data = JSON.parse(readFileSync(path, 'utf-8'));
        const encryptionSettings = getEncryptionSettings();

        // Check if data is encrypted
        if (isEncrypted(data)) {
            if (!encryptionSettings.enabled) {
                log.warn('Session is encrypted but ENCRYPTION_KEY not set. Trying SESSION_ID...');
                encryptionSettings.enabled = true;
                encryptionSettings.key = encryptionSettings.key || process.env.SESSION_ID;
            }

            if (!encryptionSettings.key) {
                throw new Error('Cannot decrypt session: no encryption key available');
            }

            log.info('Decrypting session...');
            return decrypt(data, encryptionSettings.key);
        }

        // Data is not encrypted
        if (encryptionSettings.enabled && encryptionSettings.autoMigrate) {
            log.info('Auto-migrating unencrypted session to encrypted format...');
            saveCredentials(data, path);
            log.success('Session migrated to encrypted format');
        }

        return data;
    } catch (error) {
        log.error('Failed to load credentials', { error: error.message });
        throw error;
    }
}

/**
 * Initialize session directory and restore from SESSION_ID if provided
 * @returns {Promise<boolean>} Whether session was restored
 */
export async function initSession() {
    // Ensure session directory exists
    if (!existsSync(SESSION_DIR)) {
        mkdirSync(SESSION_DIR, { recursive: true });
        log.info('Created session directory');
    }

    const credsPath = join(SESSION_DIR, 'creds.json');

    // If creds already exist locally, try to load them
    if (existsSync(credsPath)) {
        try {
            loadCredentials(credsPath);
            log.info('Using existing local session');
            return true;
        } catch (error) {
            log.error('Failed to load existing session', { error: error.message });
            log.warn('Will attempt to restore from SESSION_ID if available');
        }
    }

    // Check for SESSION_ID environment variable
    const sessionId = config.sessionId;
    if (!sessionId) {
        log.info('No SESSION_ID provided, will generate QR code');
        return false;
    }

    // Parse and download session
    const parsed = parseSessionId(sessionId);
    if (!parsed) {
        log.warn('Invalid SESSION_ID format');
        return false;
    }

    log.info(`Restoring session from ${parsed.prefix || 'Pastebin'}~${parsed.code.slice(0, 4)}...`);

    const creds = await downloadFromPastebin(parsed.code);
    if (!creds) {
        log.error('Failed to restore session from SESSION_ID');
        return false;
    }

    // Clear existing session files to prevent conflicts (Bad MAC)
    log.info('Clearing old session data before restore...');
    rmSync(SESSION_DIR, { recursive: true, force: true });
    mkdirSync(SESSION_DIR, { recursive: true });

    // Save credentials locally (with encryption if enabled)
    saveCredentials(creds, credsPath);
    log.success('Session restored successfully!');

    return true;
}

/**
 * Get the creds.json path
 * @returns {string} Path to creds.json
 */
export function getCredsPath() {
    return join(SESSION_DIR, 'creds.json');
}

/**
 * Check if session exists
 * @returns {boolean}
 */
export function hasSession() {
    return existsSync(join(SESSION_DIR, 'creds.json'));
}

export default {
    parseSessionId,
    downloadFromPastebin,
    initSession,
    getCredsPath,
    hasSession
};
