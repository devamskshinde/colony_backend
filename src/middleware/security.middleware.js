'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

const NODE_ENV = process.env.NODE_ENV || 'development';

// ---------- Security Headers ----------

/**
 * Sets standard security headers on every response.
 */
function securityHeaders(req, res, next) {
  // Strict Transport Security — enforce HTTPS for 1 year, include subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy — restrict resource loading
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy — disable unnecessary browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), interest-cohort=()');

  next();
}

// ---------- Remove X-Powered-By ----------

/**
 * Removes the X-Powered-By header that Express sets by default.
 */
function removePoweredBy(req, res, next) {
  res.removeHeader('X-Powered-By');
  next();
}

// ---------- Request ID ----------

/**
 * Attaches a unique X-Request-ID to every request and response.
 * If the client already sends one, it is preserved (useful for distributed tracing).
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

// ---------- CORS ----------

const ALLOWED_ORIGINS_DEV = true; // Allow all in development

const DEFAULT_ALLOWED_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type,Authorization,X-Request-ID,X-Timestamp,X-Signature,Accept,Origin';
const DEFAULT_MAX_AGE = 86400; // 24 hours preflight cache

/**
 * CORS middleware.
 * In development: allows all origins.
 * In production: restricts to CORS_ALLOWED_ORIGINS env var (comma-separated).
 */
function cors(req, res, next) {
  const origin = req.headers.origin;

  if (NODE_ENV === 'development') {
    // Allow all origins in development
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Production: check against allowed list
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else if (allowedOrigins.length === 0) {
      // If no origins configured, log a warning but do not allow all
      logger.warn('CORS_ALLOWED_ORIGINS not configured in production — blocking cross-origin requests');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', DEFAULT_ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', DEFAULT_ALLOWED_HEADERS);
  res.setHeader('Access-Control-Max-Age', String(DEFAULT_MAX_AGE));

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  next();
}

/**
 * Convenience function that applies all security middleware in the correct order.
 */
function applySecurityMiddleware(app) {
  app.use(removePoweredBy);
  app.use(requestId);
  app.use(securityHeaders);
  app.use(cors);
}

module.exports = {
  securityHeaders,
  removePoweredBy,
  requestId,
  cors,
  applySecurityMiddleware,
};
