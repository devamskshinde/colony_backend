'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

const SIGNING_SECRET = process.env.REQUEST_SIGNING_SECRET;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const CLOCK_SKEW_MS = 30 * 1000;   // 30 seconds tolerance

/**
 * Paths that are exempt from request signing verification.
 * Uses exact match or prefix match (paths ending with /*).
 */
const EXEMPT_PATHS = [
  '/health',
  '/healthz',
  '/readyz',
  '/api/config/version',
  '/api/auth/',
  '/api/v1/auth/',
];

/**
 * Check if the request path should skip signing verification.
 */
function isExempt(req) {
  const path = req.originalUrl.split('?')[0]; // strip query string
  return EXEMPT_PATHS.some((exempt) => {
    if (exempt.endsWith('/*')) {
      return path.startsWith(exempt.slice(0, -1));
    }
    return path === exempt;
  });
}

/**
 * Compute HMAC-SHA256 signature.
 * Payload = METHOD + PATH + BODY_HASH + TIMESTAMP
 */
function computeSignature(method, path, bodyHash, timestamp, secret) {
  const payload = `${method}${path}${bodyHash}${timestamp}`;
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 hash of the request body.
 * For empty/no body returns a hash of an empty string.
 */
function hashBody(body) {
  if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return crypto.createHash('sha256').update('', 'utf8').digest('hex');
  }
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Request signing verification middleware.
 *
 * Expects headers:
 *   X-Timestamp  — ISO-8601 or Unix epoch (ms) timestamp
 *   X-Signature  — HMAC-SHA256 hex digest
 *
 * Rejects requests where:
 *   - Headers are missing (on non-exempt paths)
 *   - Timestamp is older than 5 minutes (with clock skew tolerance)
 *   - Signature does not match
 */
function verifyRequestSignature(req, res, next) {
  // Skip for exempt paths
  if (isExempt(req)) {
    return next();
  }

  if (!SIGNING_SECRET) {
    logger.warn('REQUEST_SIGNING_SECRET not configured — skipping signature verification');
    return next();
  }

  const timestampHeader = req.headers['x-timestamp'];
  const signatureHeader = req.headers['x-signature'];

  if (!timestampHeader || !signatureHeader) {
    logger.warn('Missing signing headers', {
      path: req.originalUrl,
      method: req.method,
      hasTimestamp: !!timestampHeader,
      hasSignature: !!signatureHeader,
    });

    return res.status(401).json({
      success: false,
      message: 'Missing required signing headers (X-Timestamp, X-Signature)',
      code: 'MISSING_SIGNATURE',
      requestId: req.requestId || undefined,
    });
  }

  // Parse timestamp (supports both ISO-8601 and epoch ms)
  let requestTime;
  const numTimestamp = Number(timestampHeader);
  if (!isNaN(numTimestamp) && numTimestamp > 0) {
    requestTime = new Date(numTimestamp);
  } else {
    requestTime = new Date(timestampHeader);
  }

  if (isNaN(requestTime.getTime())) {
    return res.status(401).json({
      success: false,
      message: 'Invalid timestamp format',
      code: 'INVALID_TIMESTAMP',
      requestId: req.requestId || undefined,
    });
  }

  // Check clock skew
  const now = Date.now();
  const ageMs = Math.abs(now - requestTime.getTime());

  if (ageMs > MAX_AGE_MS + CLOCK_SKEW_MS) {
    logger.warn('Request signing: timestamp too old', {
      path: req.originalUrl,
      ageMs,
      maxAgeMs: MAX_AGE_MS,
    });

    return res.status(401).json({
      success: false,
      message: 'Request timestamp is too old. Please synchronize your clock.',
      code: 'TIMESTAMP_EXPIRED',
      requestId: req.requestId || undefined,
    });
  }

  // Compute expected signature
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split('?')[0]; // use path without query string
  const bodyHash = hashBody(req.body);
  const timestampValue = String(timestampHeader);

  const expectedSignature = computeSignature(method, path, bodyHash, timestampValue, SIGNING_SECRET);

  // Timing-safe comparison
  const sigBuf = Buffer.from(signatureHeader, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    logger.warn('Request signing: signature mismatch', {
      path: req.originalUrl,
      method,
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid request signature',
      code: 'INVALID_SIGNATURE',
      requestId: req.requestId || undefined,
    });
  }

  next();
}

module.exports = {
  verifyRequestSignature,
  computeSignature,
  hashBody,
};
