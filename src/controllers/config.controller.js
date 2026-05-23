'use strict';

const response = require('../utils/response.utils');
const logger = require('../utils/logger');
const configService = require('../services/config.service');

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /config
 * Return all configuration values resolved for the user's tier.
 * Called on app start and every 5 min polling cycle.
 * When called by an unauthenticated user, returns default/anonymous tier config.
 */
async function getConfig(req, res, next) {
  try {
    const tier = req.user?.tier || 'default';
    const config = await configService.getConfigForTier(tier);

    return response.success(res, {
      config,
      tier,
      version: config.version || 1,
    });
  } catch (err) {
    logger.error('getConfig failed', { error: err.message });
    return next(err);
  }
}

/**
 * GET /config/version
 * Lightweight endpoint that returns just the config version number.
 * Mobile clients poll this to decide whether to fetch full config.
 */
async function getConfigVersion(req, res, next) {
  try {
    const version = await configService.getConfigVersion();

    return response.success(res, { version });
  } catch (err) {
    logger.error('getConfigVersion failed', { error: err.message });
    return next(err);
  }
}

/**
 * GET /config/features
 * Return only feature-flag configs resolved for the user's tier.
 * Allows clients to toggle UI features without fetching the full config.
 */
async function getFeatureFlags(req, res, next) {
  try {
    const tier = req.user?.tier || 'default';
    const features = await configService.getFeatureFlags(tier);

    return response.success(res, {
      features,
      tier,
    });
  } catch (err) {
    logger.error('getFeatureFlags failed', { error: err.message });
    return next(err);
  }
}

module.exports = {
  getConfig,
  getConfigVersion,
  getFeatureFlags,
};
