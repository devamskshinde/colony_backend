'use strict';

const crypto = require('crypto');

const SIGNATURE_ALGORITHM = 'sha256';
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate an HMAC-SHA256 signature for a request.
 *
 * @param {string} method - HTTP method (GET, POST, etc.).
 * @param {string} path - Request path (e.g. /api/v1/users).
 * @param {string|Object} body - Request body (stringified if object).
 * @param {string} timestamp - ISO 8601 timestamp string.
 * @param {string} secret - Shared secret key.
 * @returns {string} Hex-encoded HMAC signature.
 */
function generateSignature(method, path, body, timestamp, secret) {
  const bodyHash = hashBody(body);
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  return crypto
    .createHmac(SIGNATURE_ALGORITHM, secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify an HMAC-SHA256 signature against the expected value.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @param {string|Object} body - Request body.
 * @param {string} timestamp - ISO 8601 timestamp string.
 * @param {string} signature - Signature to verify.
 * @param {string} secret - Shared secret key.
 * @returns {boolean} True if the signature is valid and timestamp is within tolerance.
 */
function verifySignature(method, path, body, timestamp, signature, secret) {
  // Validate timestamp freshness
  const requestTime = new Date(timestamp).getTime();
  if (Number.isNaN(requestTime)) return false;

  const now = Date.now();
  if (Math.abs(now - requestTime) > TIMESTAMP_TOLERANCE_MS) return false;

  const expected = generateSignature(method, path, body, timestamp, secret);

  // Timing-safe comparison
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Create a SHA-256 hash of the request body.
 * Objects are JSON-stringified first. Empty bodies hash an empty string.
 *
 * @param {string|Object} body - Request body.
 * @returns {string} Hex-encoded SHA-256 hash.
 */
function hashBody(body) {
  const data = typeof body === 'object' ? JSON.stringify(body) : (body || '');
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Generate a cryptographically random device secret (32 bytes, hex-encoded).
 * Used for per-device request signing keys.
 *
 * @returns {string} 64-character hex string.
 */
function generateDeviceSecret() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateSignature,
  verifySignature,
  hashBody,
  generateDeviceSecret,
};
