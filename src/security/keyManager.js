/**
 * Encryption Key Management
 * Manages encryption keys from environment variables with fallbacks
 */

import { generateKey } from './encryption.js';
import { log } from '../utils/logger.js';

/**
 * Get encryption key from environment or generate default
 * @returns {string} Encryption key
 */
export function getEncryptionKey() {
  // Check for encryption key in environment
  const envKey = process.env.ENCRYPTION_KEY;

  if (envKey) {
    // Validate key length (should be at least 32 characters for 256-bit encryption)
    if (envKey.length < 32) {
      log.warn('ENCRYPTION_KEY is too short. Recommended: at least 32 characters');
    }
    return envKey;
  }

  // Check for session ID (can be used as encryption key)
  const sessionId = process.env.SESSION_ID;
  if (sessionId && sessionId.length >= 32) {
    log.info('Using SESSION_ID as encryption key');
    return sessionId;
  }

  // Generate a default key (not secure for production!)
  log.warn(
    '⚠️  No ENCRYPTION_KEY found in environment!\n' +
    '   Using auto-generated key. Session encryption will reset on restart.\n' +
    '   For production, set ENCRYPTION_KEY in your .env file:\n' +
    '   ENCRYPTION_KEY=' + generateKey()
  );

  // Use a combination of available identifiers as fallback
  const fallbackKey = `midknight-${process.env.BOT_NAME || 'default'}-${process.pid}`;
  return fallbackKey;
}

/**
 * Check if encryption is enabled
 * @returns {boolean} True if encryption should be used
 */
export function isEncryptionEnabled() {
  // Encryption is enabled if ENCRYPTION_KEY is set or ENCRYPT_SESSION=true
  return !!(
    process.env.ENCRYPTION_KEY ||
    process.env.ENCRYPT_SESSION === 'true'
  );
}

/**
 * Get encryption settings
 * @returns {object} Encryption configuration
 */
export function getEncryptionSettings() {
  const enabled = isEncryptionEnabled();

  return {
    enabled,
    key: enabled ? getEncryptionKey() : null,
    algorithm: 'aes-256-gcm',
    autoMigrate: process.env.AUTO_MIGRATE_SESSIONS !== 'false' // default true
  };
}

/**
 * Validate encryption key strength
 * @param {string} key - Key to validate
 * @returns {object} Validation result
 */
export function validateKeyStrength(key) {
  const result = {
    valid: true,
    warnings: [],
    score: 0
  };

  if (!key) {
    result.valid = false;
    result.warnings.push('Key is empty');
    return result;
  }

  // Check length
  if (key.length < 32) {
    result.warnings.push('Key is shorter than recommended 32 characters');
    result.score -= 2;
  } else if (key.length >= 64) {
    result.score += 2;
  } else {
    result.score += 1;
  }

  // Check complexity
  const hasLower = /[a-z]/.test(key);
  const hasUpper = /[A-Z]/.test(key);
  const hasDigit = /\d/.test(key);
  const hasSpecial = /[^a-zA-Z0-9]/.test(key);

  const complexity = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

  if (complexity < 2) {
    result.warnings.push('Key should include multiple character types (lowercase, uppercase, digits, special)');
    result.score -= 1;
  } else if (complexity >= 3) {
    result.score += 1;
  }

  // Check entropy (simple check)
  const uniqueChars = new Set(key).size;
  if (uniqueChars < key.length * 0.5) {
    result.warnings.push('Key has low character diversity');
    result.score -= 1;
  }

  // Final validation
  if (result.score < 0) {
    result.valid = false;
  }

  return result;
}

export default {
  getEncryptionKey,
  isEncryptionEnabled,
  getEncryptionSettings,
  validateKeyStrength
};
