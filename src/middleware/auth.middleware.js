'use strict';

const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.warn('JWT_SECRET is not set. Auth middleware will fail at runtime.');
}

/**
 * Extract the Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1] || null;
}

/**
 * Check whether a token's JTI has been blacklisted in Redis.
 * Returns true if blacklisted, false otherwise.
 * Fails open (returns false) if Redis is unavailable to avoid blocking valid requests.
 */
async function isBlacklisted(jti) {
  if (!jti) return false;
  try {
    const redis = getRedisClient();
    const result = await redis.get(`colony:blacklist:${jti}`);
    return result !== null;
  } catch (err) {
    logger.error('Redis blacklist check failed, failing open', { jti, error: err.message });
    return false;
  }
}

/**
 * Core token verification logic shared by authenticate and optionalAuthenticate.
 * Returns the decoded payload or throws an error with a `code` property.
 */
async function verifyAndAttach(req) {
  const token = extractToken(req);
  if (!token) {
    const err = new Error('Authentication required');
    err.code = 'NO_TOKEN';
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (jwtErr) {
    if (jwtErr.name === 'TokenExpiredError') {
      const err = new Error('Token has expired');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }
    const err = new Error('Invalid token');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  // Check blacklist using the JTI claim
  const jti = decoded.jti || decoded.jti === 0 ? String(decoded.jti) : null;
  if (jti && await isBlacklisted(jti)) {
    const err = new Error('Token has been revoked');
    err.code = 'TOKEN_REVOKED';
    throw err;
  }

  // Attach decoded user to request
  req.user = {
    id: decoded.id || decoded.sub,
    phone: decoded.phone,
    tier: decoded.tier || 'free',
    deviceId: decoded.deviceId,
    jti,
  };

  return req.user;
}

/**
 * Required authentication middleware.
 * Rejects the request with 401 if no valid token is present.
 */
async function authenticate(req, res, next) {
  try {
    await verifyAndAttach(req);
    next();
  } catch (err) {
    const statusCode = 401;
    const responseCode = err.code || 'INVALID_TOKEN';

    logger.warn('Authentication failed', {
      code: responseCode,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    return res.status(statusCode).json({
      success: false,
      message: err.message,
      code: responseCode,
      requestId: req.requestId || undefined,
    });
  }
}

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid token is present, but does NOT reject if missing or invalid.
 */
async function optionalAuthenticate(req, res, next) {
  try {
    await verifyAndAttach(req);
  } catch (_err) {
    // Swallow the error — user simply remains unauthenticated
    req.user = null;
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
};
