'use strict';

const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Redis-based sliding-window rate limiter using INCR + EXPIRE.
 *
 * Factory function that returns Express middleware.
 *
 * @param {Object} options
 * @param {string} options.prefix     - Redis key prefix (e.g. "rl:otp")
 * @param {number} options.limit      - Max requests allowed in the window
 * @param {number} options.windowMs   - Window duration in milliseconds
 * @param {function} [options.keyFn]  - Function(req) => string to derive the rate-limit key.
 *                                       Defaults to req.ip.
 * @param {string} [options.message]  - Custom 429 message
 * @returns {Function} Express middleware
 */
function createRateLimiter({ prefix, limit, windowMs, keyFn, message }) {
  const windowSec = Math.ceil(windowMs / 1000);
  const resolveKey = keyFn || ((req) => req.ip || 'unknown');
  const errorMessage = message || 'Too many requests, please try again later';

  return async function rateLimiter(req, res, next) {
    let redis;
    try {
      redis = getRedisClient();
    } catch (err) {
      logger.error('Rate limiter: Redis unavailable, allowing request', { prefix, error: err.message });
      return next();
    }

    const identifier = resolveKey(req);
    const key = `${prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use a Redis pipeline for atomicity
      const pipeline = redis.pipeline();

      // Remove expired entries (sliding window)
      pipeline.zremrangebyscore(key, 0, windowStart);
      // Add the current request timestamp as a unique member
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 10)}`);
      // Count requests in the current window
      pipeline.zcard(key);
      // Set expiry so keys are cleaned up even if the user stops making requests
      pipeline.expire(key, windowSec);

      const results = await pipeline.exec();

      // results is [[err, value], ...] — index 2 is zcard
      const requestCount = results[2][1];

      // Set rate-limit headers
      const remaining = Math.max(0, limit - requestCount);
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

      if (requestCount > limit) {
        const retryAfterSec = windowSec;
        res.setHeader('Retry-After', retryAfterSec);

        logger.warn('Rate limit exceeded', {
          prefix,
          identifier,
          requestCount,
          limit,
        });

        return res.status(429).json({
          success: false,
          message: errorMessage,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: retryAfterSec,
          requestId: req.requestId || undefined,
        });
      }

      next();
    } catch (err) {
      logger.error('Rate limiter error, allowing request', { prefix, error: err.message });
      next();
    }
  };
}

// ---------- Pre-configured limiters ----------

const generalLimiter = createRateLimiter({
  prefix: 'rl:general',
  limit: 100,
  windowMs: 60 * 1000, // 1 minute
  keyFn: (req) => (req.user && req.user.id) || req.ip || 'unknown',
  message: 'Too many requests from this account, please slow down',
});

const otpLimiter = createRateLimiter({
  prefix: 'rl:otp',
  limit: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyFn: (req) => {
    // Prefer phone from body; fall back to IP
    const phone = req.body && req.body.phone;
    return phone || req.ip || 'unknown';
  },
  message: 'Too many OTP requests for this phone number, please try again later',
});

const authLimiter = createRateLimiter({
  prefix: 'rl:auth',
  limit: 10,
  windowMs: 60 * 1000, // 1 minute
  keyFn: (req) => req.ip || 'unknown',
  message: 'Too many authentication attempts, please try again later',
});

const locationLimiter = createRateLimiter({
  prefix: 'rl:location',
  limit: 60,
  windowMs: 60 * 1000, // 1 minute
  keyFn: (req) => (req.user && req.user.id) || req.ip || 'unknown',
  message: 'Too many location requests, please slow down',
});

module.exports = {
  createRateLimiter,
  generalLimiter,
  otpLimiter,
  authLimiter,
  locationLimiter,
};
