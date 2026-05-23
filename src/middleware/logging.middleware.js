'use strict';

const logger = require('../utils/logger');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DEV = NODE_ENV === 'development';

/**
 * Fields that should be redacted from logged request bodies.
 */
const SENSITIVE_BODY_FIELDS = [
  'password',
  'confirmPassword',
  'oldPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'otp',
  'secret',
  'otpCode',
  'verificationCode',
];

/**
 * Create a shallow copy of the body with sensitive fields replaced.
 */
function redactBody(body) {
  if (!body || typeof body !== 'object') return body;
  const redacted = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_BODY_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Extract a safe representation of the request body for logging.
 * Only logs in development. In production, body is never logged.
 */
function safeBody(req) {
  if (!IS_DEV) return undefined;
  if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
    return undefined;
  }
  return redactBody(req.body);
}

/**
 * Request logging middleware.
 *
 * Logs on response finish:
 *   method, path, status, response time (ms), userId, requestId, IP
 *
 * In development also logs the request body with sensitive fields redacted.
 */
function requestLogger(req, res, next) {
  const startTime = process.hrtime.bigint();

  // Capture userId early in case it is set later by auth middleware
  const getUserId = () => (req.user && req.user.id) || '-';

  // Log when the response has been fully sent
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6; // nanoseconds to ms

    const meta = {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100, // 2 decimal places
      userId: getUserId(),
      requestId: req.requestId || '-',
      ip: req.ip || req.connection?.remoteAddress || '-',
      userAgent: req.headers['user-agent'] || '-',
      contentLength: res.getHeader('content-length') || '-',
    };

    const body = safeBody(req);
    if (body) {
      meta.body = body;
    }

    // Use appropriate log level based on status code
    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    } else {
      logger.http(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    }
  });

  next();
}

module.exports = {
  requestLogger,
};
