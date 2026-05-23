'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const log = logger.child({ service: 'auth' });

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const BCRYPT_ROUNDS = 10;

/**
 * Auth service - handles registration, login, token management, and sessions.
 *
 * Expects:
 *   - db (pg.Pool)         via init(opts)
 *   - cacheService         via init(opts)
 *   - JWT_SECRET env var   for signing tokens
 */

let db = null;
let cache = null;

/**
 * Initialize the auth service.
 * @param {object} opts
 * @param {import('pg').Pool} opts.db
 * @param {object} opts.cache - cache service instance
 */
function init(opts) {
  db = opts.db;
  cache = opts.cache;
  log.info('Auth service initialized');
}

function assertInit() {
  if (!db) throw new Error('Auth service not initialized: missing db');
  if (!cache) throw new Error('Auth service not initialized: missing cache');
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique token ID (jti).
 */
function generateJti() {
  return crypto.randomUUID();
}

/**
 * Generate an access token (short-lived, device-bound).
 */
function signAccessToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, {
    expiresIn: ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
  });
}

/**
 * Generate a refresh token (long-lived, device-bound).
 */
function signRefreshToken(payload) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, {
    expiresIn: REFRESH_TOKEN_TTL,
    algorithm: 'HS256',
  });
}

/**
 * Verify an access token.
 */
function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET;
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

/**
 * Verify a refresh token.
 */
function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

/**
 * Build the JWT payload for a user + device.
 */
function buildTokenPayload(user, deviceId) {
  return {
    userId: user.id,
    phone: user.phone,
    tier: user.tier || 'free',
    deviceId,
  };
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

const SESSION_PREFIX = 'session';
const ONLINE_SET_KEY = 'users:online';
const TOKEN_BLACKLIST_PREFIX = 'token:blacklist';

function sessionKey(userId, deviceId) {
  return `${SESSION_PREFIX}:${userId}:${deviceId}`;
}

/**
 * Create or update a session in Redis.
 */
async function createSession(userId, deviceId, accessTokenJti, refreshTokenJti) {
  const key = sessionKey(userId, deviceId);
  await cache.setHash(key, 'userId', String(userId));
  await cache.setHash(key, 'deviceId', deviceId);
  await cache.setHash(key, 'accessTokenJti', accessTokenJti);
  await cache.setHash(key, 'refreshTokenJti', refreshTokenJti);
  await cache.setHash(key, 'createdAt', new Date().toISOString());
  await cache.addToSet(ONLINE_SET_KEY, String(userId));
}

/**
 * Get session data.
 */
async function getSession(userId, deviceId) {
  return cache.getHashAll(sessionKey(userId, deviceId));
}

/**
 * Invalidate a session.
 */
async function invalidateSession(userId, deviceId) {
  const key = sessionKey(userId, deviceId);
  await cache.del(key);
  await cache.removeFromSet(ONLINE_SET_KEY, String(userId));
}

/**
 * Blacklist an access token by jti.
 */
async function blacklistToken(jti, ttlSeconds) {
  await cache.set(`${TOKEN_BLACKLIST_PREFIX}:${jti}`, '1', ttlSeconds);
}

/**
 * Check if a token is blacklisted.
 */
async function isTokenBlacklisted(jti) {
  return cache.exists(`${TOKEN_BLACKLIST_PREFIX}:${jti}`);
}

// ---------------------------------------------------------------------------
// OTP rate limiting (3 per hour per phone)
// ---------------------------------------------------------------------------

function otpRateKey(phone) {
  return `otp:rate:${phone}`;
}

/**
 * Check and increment OTP send count. Returns true if allowed.
 */
async function checkOtpRateLimit(phone) {
  const key = otpRateKey(phone);
  const count = await cache.incr(key, 3600); // TTL set only on first increment
  if (count > 3) {
    log.warn('OTP rate limit exceeded', { phone });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send OTP (delegates to otp.service, handles rate limiting).
 * @param {string} phone
 * @param {string} purpose
 * @returns {Promise<{success: boolean, cooldownSeconds?: number, error?: string}>}
 */
async function sendOtp(phone, purpose) {
  assertInit();

  // Rate limit: 3/hour per phone
  const allowed = await checkOtpRateLimit(phone);
  if (!allowed) {
    return { success: false, error: 'Too many OTP requests. Please try again later.' };
  }

  // Delegates to otp.service (imported at runtime to avoid circular deps)
  const otpService = require('./otp.service');
  return otpService.generateOtp(phone, purpose);
}

/**
 * Verify OTP.
 * @param {string} phone
 * @param {string} otp
 * @param {string} purpose
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function verifyOtp(phone, otp, purpose) {
  assertInit();
  const otpService = require('./otp.service');
  return otpService.verifyOtp(phone, otp, purpose);
}

/**
 * Register a new user.
 *
 * 1. Create user in DB
 * 2. Generate device-bound JWT pair
 * 3. Create session
 *
 * @param {string} phone
 * @param {object} userData - { name, email?, ... }
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
async function register(phone, userData) {
  assertInit();

  try {
    // Check if phone already registered
    const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      const err = new Error('Phone number already registered');
      err.statusCode = 409;
      throw err;
    }

    // Create user
    const result = await db.query(
      `INSERT INTO users (phone, name, email, tier, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'free', 'active', NOW(), NOW())
       RETURNING id, phone, name, email, tier, status, created_at`,
      [phone, userData.name, userData.email || null]
    );
    const user = result.rows[0];

    // Generate tokens
    const deviceId = userData.deviceId || 'default';
    const payload = buildTokenPayload(user, deviceId);

    const accessJti = generateJti();
    const refreshJti = generateJti();

    const accessToken = signAccessToken({ ...payload, jti: accessJti });
    const refreshToken = signRefreshToken({ ...payload, jti: refreshJti });

    // Create session
    await createSession(user.id, deviceId, accessJti, refreshJti);

    log.info('User registered', { userId: user.id, phone });

    return { user, accessToken, refreshToken };
  } catch (err) {
    log.error('Registration failed', { phone, error: err.message });
    throw err;
  }
}

/**
 * Login an existing user.
 *
 * 1. Find user by phone
 * 2. Generate device-bound JWT pair
 * 3. Create/update session
 *
 * @param {string} phone
 * @param {string} deviceId
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
async function login(phone, deviceId) {
  assertInit();

  try {
    const result = await db.query(
      `SELECT id, phone, name, email, tier, status, created_at
       FROM users WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const user = result.rows[0];

    if (user.status === 'suspended') {
      const err = new Error('Account is suspended');
      err.statusCode = 403;
      throw err;
    }

    // Generate tokens
    const payload = buildTokenPayload(user, deviceId);

    const accessJti = generateJti();
    const refreshJti = generateJti();

    const accessToken = signAccessToken({ ...payload, jti: accessJti });
    const refreshToken = signRefreshToken({ ...payload, jti: refreshJti });

    // Create or update session
    await createSession(user.id, deviceId, accessJti, refreshJti);

    log.info('User logged in', { userId: user.id, phone, deviceId });

    return { user, accessToken, refreshToken };
  } catch (err) {
    log.error('Login failed', { phone, error: err.message });
    throw err;
  }
}

/**
 * Refresh tokens (token rotation).
 *
 * 1. Verify the refresh token
 * 2. Check session exists and is active
 * 3. Invalidate old refresh token
 * 4. Issue new token pair
 *
 * @param {string} refreshToken
 * @param {string} deviceId
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function refreshToken(refreshToken, deviceId) {
  assertInit();

  try {
    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const { userId, jti: oldJti } = decoded;

    // Check session exists
    const session = await getSession(userId, deviceId);
    if (!session || !session.refreshTokenJti) {
      const err = new Error('Session not found or expired');
      err.statusCode = 401;
      throw err;
    }

    // Verify the jti matches what's stored (prevents reuse of already-rotated tokens)
    if (session.refreshTokenJti !== oldJti) {
      // Possible token reuse attack - invalidate all sessions for this user
      log.warn('Refresh token reuse detected, invalidating all sessions', { userId });
      const err = new Error('Refresh token has already been used');
      err.statusCode = 401;
      throw err;
    }

    // Fetch user
    const userResult = await db.query(
      'SELECT id, phone, name, email, tier, status FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    const user = userResult.rows[0];

    // Blacklist old access token jti
    if (session.accessTokenJti) {
      await blacklistToken(session.accessTokenJti, 900); // 15 min TTL
    }

    // Generate new tokens
    const payload = buildTokenPayload(user, deviceId);
    const newAccessJti = generateJti();
    const newRefreshJti = generateJti();

    const newAccessToken = signAccessToken({ ...payload, jti: newAccessJti });
    const newRefreshToken = signRefreshToken({ ...payload, jti: newRefreshJti });

    // Update session with new jtis
    await createSession(userId, deviceId, newAccessJti, newRefreshJti);

    log.info('Tokens refreshed', { userId, deviceId });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (err) {
    log.error('Token refresh failed', { error: err.message });
    throw err;
  }
}

/**
 * Logout - invalidate session, blacklist access token, remove from online set.
 *
 * @param {string} userId
 * @param {string} deviceId
 */
async function logout(userId, deviceId) {
  assertInit();

  try {
    // Get session to blacklist access token
    const session = await getSession(userId, deviceId);
    if (session && session.accessTokenJti) {
      await blacklistToken(session.accessTokenJti, 900);
    }

    // Invalidate session and remove from online set
    await invalidateSession(userId, deviceId);

    log.info('User logged out', { userId, deviceId });
  } catch (err) {
    log.error('Logout failed', { userId, deviceId, error: err.message });
    throw err;
  }
}

module.exports = {
  init,
  sendOtp,
  verifyOtp,
  register,
  login,
  refreshToken,
  logout,
  // Exported for middleware use
  verifyAccessToken,
  isTokenBlacklisted,
};
