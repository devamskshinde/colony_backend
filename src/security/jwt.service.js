'use strict';

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET;

// Token expiry durations
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const ADMIN_TOKEN_EXPIRY = '1h';

// TTL in seconds for Redis blacklist entries
const ACCESS_TOKEN_TTL = 15 * 60;         // 15 minutes
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days
const ADMIN_TOKEN_TTL = 60 * 60;           // 1 hour

const BLACKLIST_PREFIX = 'token:blacklist:';

/**
 * Generate a short-lived access token.
 * @param {Object} payload - Claims to embed (sub, role, etc.).
 * @param {string} [deviceId] - Device identifier for multi-device management.
 * @returns {string} Signed JWT.
 */
function generateAccessToken(payload, deviceId) {
  const jti = uuidv4();
  return jwt.sign(
    { ...payload, jti, deviceId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate a long-lived refresh token.
 * @param {Object} payload - Claims to embed (sub, etc.).
 * @returns {string} Signed JWT.
 */
function generateRefreshToken(payload) {
  const jti = uuidv4();
  return jwt.sign(
    { ...payload, jti, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Generate an admin-scoped token signed with the admin secret.
 * @param {Object} payload - Claims to embed (sub, role, permissions, etc.).
 * @returns {string} Signed JWT.
 */
function generateAdminToken(payload) {
  const jti = uuidv4();
  return jwt.sign(
    { ...payload, jti, type: 'admin' },
    JWT_ADMIN_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode an access token.
 * @param {string} token - JWT string.
 * @returns {Object} Decoded payload.
 * @throws {Error} If token is invalid or expired.
 */
function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

/**
 * Verify and decode a refresh token.
 * @param {string} token - JWT string.
 * @returns {Object} Decoded payload.
 * @throws {Error} If token is invalid or expired.
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

/**
 * Verify and decode an admin token.
 * @param {string} token - JWT string.
 * @returns {Object} Decoded payload.
 * @throws {Error} If token is invalid or expired.
 */
function verifyAdminToken(token) {
  const decoded = jwt.verify(token, JWT_ADMIN_SECRET);
  if (decoded.type !== 'admin') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

/**
 * Blacklist a token by its jti so it cannot be used again.
 * Used for logout and token revocation.
 * @param {string} jti - The JWT ID to blacklist.
 * @param {number} expirySeconds - TTL in seconds (should match token remaining life).
 */
async function blacklistToken(jti, expirySeconds) {
  const client = redis.getClient();
  await client.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', expirySeconds);
}

/**
 * Check whether a token jti has been blacklisted.
 * @param {string} jti - The JWT ID to check.
 * @returns {boolean} True if the token is blacklisted.
 */
async function isTokenBlacklisted(jti) {
  const client = redis.getClient();
  const result = await client.get(`${BLACKLIST_PREFIX}${jti}`);
  return result === '1';
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateAdminToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyAdminToken,
  blacklistToken,
  isTokenBlacklisted,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  ADMIN_TOKEN_TTL,
};
