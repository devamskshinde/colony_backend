'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 12;

// AES-256-GCM constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128-bit IV
const TAG_LENGTH = 16;  // 128-bit auth tag
const KEY_LENGTH = 32;  // 256-bit key

/**
 * Hash a plaintext password using bcrypt.
 * @param {string} password - Plaintext password.
 * @returns {Promise<string>} Bcrypt hash string.
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} password - Plaintext password.
 * @param {string} hash - Bcrypt hash to compare against.
 * @returns {Promise<boolean>} True if the password matches.
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Create a SHA-256 hash of arbitrary data.
 * @param {string} data - Data to hash.
 * @returns {string} Hex-encoded SHA-256 hash.
 */
function hashData(data) {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Generate a cryptographically secure 6-digit OTP.
 * @returns {number} Integer between 100000 and 999999 inclusive.
 */
function generateOtp() {
  return crypto.randomInt(100000, 999999);
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * Output format: iv(hex):authTag(hex):ciphertext(hex)
 * This format allows decryption to extract all components.
 *
 * @param {string} text - Plaintext to encrypt.
 * @param {string} key - 256-bit key as a hex string (64 chars), or a passphrase
 *                       that will be hashed to derive a 256-bit key.
 * @returns {string} Encrypted string in the format "iv:authTag:ciphertext" (all hex).
 */
function encrypt(text, key) {
  const keyBuffer = deriveKey(key);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt ciphertext produced by the encrypt function.
 *
 * @param {string} encrypted - String in the format "iv:authTag:ciphertext" (all hex).
 * @param {string} key - Same key used for encryption.
 * @returns {string} Decrypted plaintext.
 * @throws {Error} If decryption fails (wrong key, tampered data, etc.).
 */
function decrypt(encrypted, key) {
  const keyBuffer = deriveKey(key);
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Derive a 256-bit key from the input.
 * If the input is a 64-char hex string, treat it as a raw 256-bit key.
 * Otherwise, hash it with SHA-256 to produce a consistent 256-bit key.
 *
 * @param {string} key - Hex key or passphrase.
 * @returns {Buffer} 32-byte key buffer.
 */
function deriveKey(key) {
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // Derive a key from a passphrase via SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

module.exports = {
  hashPassword,
  comparePassword,
  hashData,
  generateOtp,
  encrypt,
  decrypt,
};
