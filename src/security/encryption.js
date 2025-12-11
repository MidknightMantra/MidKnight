/**
 * Session Encryption Module
 * Provides AES-256-GCM encryption for session credentials
 * Uses Node.js built-in crypto module (no external dependencies)
 */

import crypto from 'crypto';

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16;
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - Encryption password
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived key
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string|object} data - Data to encrypt (will be JSON stringified if object)
 * @param {string} password - Encryption password
 * @returns {object} Encrypted data with iv, salt, authTag
 */
export function encrypt(data, password) {
  if (!password) {
    throw new Error('Encryption password is required');
  }

  if (!data) {
    throw new Error('Data to encrypt is required');
  }

  // Convert data to string if it's an object
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

  // Generate random IV and salt
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Derive key from password
  const key = deriveKey(password, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: ALGORITHM,
    version: 1
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {object} encryptedData - Encrypted data object
 * @param {string} password - Decryption password
 * @returns {object|string} Decrypted data
 */
export function decrypt(encryptedData, password) {
  if (!password) {
    throw new Error('Decryption password is required');
  }

  if (!encryptedData || !encryptedData.encrypted) {
    throw new Error('Invalid encrypted data');
  }

  const {
    encrypted,
    iv,
    salt,
    authTag,
    algorithm = ALGORITHM,
    version = 1
  } = encryptedData;

  // Validate version
  if (version !== 1) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  // Convert from base64
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  const saltBuffer = Buffer.from(salt, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');

  // Derive key
  const key = deriveKey(password, saltBuffer);

  // Create decipher
  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);

  const plaintext = decrypted.toString('utf8');

  // Try to parse as JSON, otherwise return string
  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}

/**
 * Check if data is encrypted (has encryption metadata)
 * @param {any} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
export function isEncrypted(data) {
  return (
    data &&
    typeof data === 'object' &&
    data.encrypted &&
    data.iv &&
    data.salt &&
    data.authTag &&
    data.algorithm
  );
}

/**
 * Generate a secure random encryption key
 * @param {number} length - Key length in bytes (default: 32)
 * @returns {string} Random key in hex format
 */
export function generateKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password for storage or comparison
 * @param {string} password - Password to hash
 * @param {string} salt - Optional salt (will generate if not provided)
 * @returns {object} Hash and salt
 */
export function hashPassword(password, salt = null) {
  const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(password, saltBuffer, ITERATIONS, KEY_LENGTH, 'sha256');

  return {
    hash: hash.toString('hex'),
    salt: saltBuffer.toString('hex'),
    iterations: ITERATIONS
  };
}

/**
 * Verify password against hash
 * @param {string} password - Password to verify
 * @param {string} hash - Stored hash
 * @param {string} salt - Stored salt
 * @returns {boolean} True if password matches
 */
export function verifyPassword(password, hash, salt) {
  const result = hashPassword(password, salt);
  return crypto.timingSafeEqual(
    Buffer.from(result.hash, 'hex'),
    Buffer.from(hash, 'hex')
  );
}

export default {
  encrypt,
  decrypt,
  isEncrypted,
  generateKey,
  hashPassword,
  verifyPassword
};
