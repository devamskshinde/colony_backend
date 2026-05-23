'use strict';

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('./utils/logger');
const { HONEYPOT_PATHS } = require('./config/constants');

// Existing middleware modules
const { applySecurityMiddleware } = require('./middleware/security.middleware');
const { requestLogger } = require('./middleware/logging.middleware');
const { verifyRequestSignature } = require('./middleware/requestSigning.middleware');
const { generalLimiter } = require('./middleware/rateLimit.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');

// Routes
const apiRoutes = require('./routes/index');

const app = express();

// ═══════════════════════════════════════════════════════════════════════════
// 1. Helmet -- sets various HTTP security headers
// ═══════════════════════════════════════════════════════════════════════════

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ═══════════════════════════════════════════════════════════════════════════
// 2. Compression
// ═══════════════════════════════════════════════════════════════════════════

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// ═══════════════════════════════════════════════════════════════════════════
// 3. Security middleware (removePoweredBy, requestId, securityHeaders, CORS)
// ═══════════════════════════════════════════════════════════════════════════

applySecurityMiddleware(app);

// ═══════════════════════════════════════════════════════════════════════════
// 4. Request logging
// ═══════════════════════════════════════════════════════════════════════════

app.use(requestLogger);

// ═══════════════════════════════════════════════════════════════════════════
// 5. Request signing verification (conditional -- only when secret is set)
// ═══════════════════════════════════════════════════════════════════════════

app.use(verifyRequestSignature);

// ═══════════════════════════════════════════════════════════════════════════
// 6. Rate limiting (global)
// ═══════════════════════════════════════════════════════════════════════════

app.use(generalLimiter);

// ═══════════════════════════════════════════════════════════════════════════
// 7. Body parsing (10 MB limit)
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ═══════════════════════════════════════════════════════════════════════════
// 8. Health check endpoints (before ban middleware so they are always reachable)
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Honeypot routes -- log and ban the source IP
// Must be registered BEFORE the IP ban middleware so they trigger the ban.
// Must be BEFORE the API routes so they are never shadowed.
// ═══════════════════════════════════════════════════════════════════════════

const honeypotBans = new Map(); // In production, consider moving to Redis

function honeypotHandler(route) {
  return (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    logger.error('Honeypot triggered -- potential attacker', {
      ip,
      route,
      method: req.method,
      userAgent,
      body: logger.redactSensitive(req.body),
      timestamp: new Date().toISOString(),
    });

    // Ban the IP for 24 hours
    honeypotBans.set(ip, Date.now() + 24 * 60 * 60 * 1000);

    // Return a convincing "not found"
    res.status(404).json({ error: 'Not found' });
  };
}

for (const route of HONEYPOT_PATHS) {
  app.all(route, honeypotHandler(route));
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. IP ban check middleware -- blocks IPs that hit honeypots.
// Must run BEFORE normal API routes.
// ═══════════════════════════════════════════════════════════════════════════

app.use((req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const banExpiry = honeypotBans.get(ip);

  if (banExpiry) {
    if (Date.now() < banExpiry) {
      logger.warn('Blocked banned IP', { ip, remainingMs: banExpiry - Date.now() });
      return res.status(403).json({ error: 'Forbidden' });
    }
    honeypotBans.delete(ip);
  }

  next();
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Mount API routes
// ═══════════════════════════════════════════════════════════════════════════

// The routes/index.js file handles:
//   /api/v1/auth, /api/v1/users, /api/v1/location, /api/v1/config, /api/v1/admin/config
app.use('/api/v1', apiRoutes);

// ═══════════════════════════════════════════════════════════════════════════
// 12. 404 handler (for routes that did not match anything above)
// ═══════════════════════════════════════════════════════════════════════════

app.use(notFoundHandler);

// ═══════════════════════════════════════════════════════════════════════════
// 13. Global error handler
// ═══════════════════════════════════════════════════════════════════════════

app.use(errorHandler);

module.exports = app;
