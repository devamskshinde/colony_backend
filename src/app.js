'use strict';

const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const hpp = require('hpp');
const env = require('./config/environment');
const { securityHeaders, removePoweredBy, requestId, cors } = require('./middleware/security.middleware');
const { requestLogger } = require('./middleware/logging.middleware');
const { generalLimiter } = require('./middleware/rateLimit.middleware');
const { verifyRequestSignature } = require('./middleware/requestSigning.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');
const routes = require('./routes');
const logger = require('./utils/logger');
const { success } = require('./utils/response.utils');

const app = express();

app.set('trust proxy', 1);

// Security
app.use(securityHeaders);
app.use(removePoweredBy);
app.use(requestId);
app.use(cors);

// Compression
app.use(compression({ threshold: 1024 }));

// Logging
app.use(morgan(env.IS_PRODUCTION ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));
app.use(requestLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(hpp());

// Request signing — DISABLED globally. Re-enable per-route when proper
// key exchange is implemented. Auth routes are exempt anyway, and the
// Flutter app uses a placeholder signing key that will never match.
// app.use(verifyRequestSignature);

// Rate limiting
app.use(generalLimiter);

// Health check
app.get('/health', (req, res) => success(res, { status: 'ok', uptime: process.uptime() }));
app.get('/ready', async (req, res) => {
  try {
    const { query } = require('./config/database');
    await query('SELECT 1');
    success(res, { status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

// API routes
app.use('/api/v1', routes);

// 404 + error handler
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
