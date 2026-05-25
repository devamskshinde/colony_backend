'use strict';

const { Router } = require('express');
const Joi = require('joi');
const response = require('../../utils/response.utils');
const logger = require('../../utils/logger');
const { adminAuthenticate } = require('../../middleware/adminAuth.middleware');
const configService = require('../../services/config.service');
const { pool: db } = require('../../config/database');

const router = Router();

// ---------------------------------------------------------------------------
// All admin config routes require admin authentication
// ---------------------------------------------------------------------------
router.use(adminAuthenticate);

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const updateConfigSchema = Joi.object({
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.object(),
    Joi.array(),
  ).required().messages({
    'any.required': 'Config value is required',
  }),
  description: Joi.string().trim().max(500).optional(),
});

const createConfigSchema = Joi.object({
  key: Joi.string().trim().min(1).max(100).pattern(/^[a-z0-9_]+$/).required().messages({
    'string.pattern.base': 'Key must be lowercase alphanumeric with underscores',
    'any.required': 'Config key is required',
  }),
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.object(),
    Joi.array(),
  ).required().messages({
    'any.required': 'Config value is required',
  }),
  description: Joi.string().trim().max(500).optional(),
  tier: Joi.string().valid('default', 'basic', 'premium', 'admin').default('default'),
  isFeature: Joi.boolean().default(false),
});

const getLogsSchema = Joi.object({
  key: Joi.string().trim().optional(),
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

// ---------------------------------------------------------------------------
// GET /admin/config
// List all configuration entries with full details (values, tiers, metadata).
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const configs = await configService.getAllConfigs();

    return response.success(res, configs);
  } catch (err) {
    logger.error('admin:getAllConfigs failed', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /admin/config/:key
// Update a config value by key. Records the change in the audit log.
// ---------------------------------------------------------------------------
router.put('/:key', async (req, res, next) => {
  try {
    const keySchema = Joi.object({
      key: Joi.string().trim().min(1).max(100).required(),
    });
    const { error: keyError } = keySchema.validate(req.params);
    if (keyError) {
      return response.badRequest(res, 'Invalid config key');
    }

    const { error: validationError, value } = updateConfigSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const updated = await configService.updateConfig(req.params.key, {
      value: value.value,
      description: value.description,
      updatedBy: req.admin.id,
    });

    if (!updated) {
      return response.notFound(res, `Config key '${req.params.key}' not found`);
    }

    return response.success(res, { config: updated }, 'Config updated');
  } catch (err) {
    logger.error('admin:updateConfig failed', { error: err.message, key: req.params?.key });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /admin/config
// Create a new configuration entry.
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { error: validationError, value } = createConfigSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const existing = await configService.getConfigByKey(value.key);
    if (existing) {
      return response.conflict(res, `Config key '${value.key}' already exists`);
    }

    const config = await configService.createConfig({
      ...value,
      createdBy: req.admin.id,
    });

    return response.created(res, { config }, 'Config created');
  } catch (err) {
    logger.error('admin:createConfig failed', { error: err.message, key: req.body?.key });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/config/logs
// Retrieve config change history / audit trail.
// ---------------------------------------------------------------------------
router.get('/logs', async (req, res, next) => {
  try {
    const { error: validationError, value } = getLogsSchema.validate(req.query, { abortEarly: false, convert: true });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { key, limit, offset } = value;
    const logs = await configService.getConfigLogs({ key, limit, offset });

    return response.success(res, {
      logs: logs.entries,
      total: logs.total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('admin:getConfigLogs failed', { error: err.message });
    return next(err);
  }
});

// ─── GET /admin/config/categories ──────────────────────────
router.get('/categories', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT category, COUNT(*)::int AS item_count
       FROM remote_config GROUP BY category ORDER BY category`
    );
    const cats = result.rows.map((r) => ({
      id: r.category,
      name: r.category.charAt(0).toUpperCase() + r.category.slice(1),
      description: '',
      icon: '',
      itemCount: r.item_count,
    }));
    return response.success(res, cats);
  } catch (err) {
    logger.error('admin:getConfigCategories failed', { error: err.message });
    return next(err);
  }
});

// ─── GET /admin/config/category/:category ──────────────────
router.get('/category/:category', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT key, value, value_type, category, tier_values, label, description,
              min_value, max_value, last_modified_at, last_modified_by, version
       FROM remote_config WHERE category = $1 ORDER BY key`,
      [req.params.category]
    );
    return response.success(res, result.rows);
  } catch (err) {
    logger.error('admin:getConfigByCategory failed', { error: err.message });
    return next(err);
  }
});

// ─── POST /admin/config/push ───────────────────────────────
router.post('/push', async (req, res, next) => {
  try {
    const { changes, reason } = req.body;
    if (!changes || typeof changes !== 'object') {
      return response.badRequest(res, 'Missing "changes" object');
    }

    const updated = [];
    for (const [key, change] of Object.entries(changes)) {
      const { value } = change;
      try {
        await db.query(
          `UPDATE remote_config SET value = $1, last_modified_by = $2, last_modified_at = NOW(), version = version + 1
           WHERE key = $3`,
          [typeof value === 'object' ? JSON.stringify(value) : String(value), req.admin.id, key]
        );
        updated.push(key);
      } catch (e) {
        logger.warn('config push: failed to update key', { key, error: e.message });
      }
    }

    return response.success(res, { updated }, `Pushed ${updated.length} config changes`);
  } catch (err) {
    logger.error('admin:pushConfig failed', { error: err.message });
    return next(err);
  }
});

module.exports = router;
