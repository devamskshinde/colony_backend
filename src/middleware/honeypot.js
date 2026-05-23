'use strict';

const constants = require('../config/constants');

function honeypotMiddleware(req, res, next) {
  const path = req.originalUrl || req.url;
  if (constants.HONEYPOT_PATHS.some(hp => path.startsWith(hp))) {
    const logger = require('../utils/logger');
    logger.warn('HONEYPOT HIT — IP flagged', {
      ip: req.ip,
      path,
      method: req.method,
      userAgent: req.get('user-agent'),
    });
    // Return 404 to not reveal the trap
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

module.exports = { honeypotMiddleware };
