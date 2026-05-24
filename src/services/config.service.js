'use strict';

const logger = require('../utils/logger');
const log = logger.child({ service: 'config' });

let db = null;

function init(dbPool) {
  db = dbPool;
  log.info('Config service initialized');
}

/**
 * Get all config values for a given user tier
 */
async function getConfigForTier(tier = 'free') {
  try {
    const result = await db.query(
      `SELECT key, value, value_type, category, tier_values, label, description
       FROM remote_config ORDER BY category, key`
    );

    return result.rows.map(row => {
      let resolvedValue = row.value;

      if (row.value_type === 'tier' && row.tier_values) {
        const tierValues = typeof row.tier_values === 'string'
          ? JSON.parse(row.tier_values)
          : row.tier_values;
        resolvedValue = tierValues[tier] !== undefined ? tierValues[tier] : tierValues['free'];
      }

      return {
        key: row.key,
        value: resolvedValue,
        value_type: row.value_type,
        category: row.category,
        label: row.label,
        description: row.description,
      };
    });
  } catch (err) {
    log.error('Failed to get config for tier', { tier, error: err.message });
    throw err;
  }
}

/**
 * Get config version for polling
 */
async function getConfigVersion() {
  try {
    const result = await db.query('SELECT COALESCE(MAX(version), 1) as version FROM remote_config');
    return result.rows[0].version;
  } catch (err) {
    log.error('Failed to get config version', { error: err.message });
    return 1;
  }
}

/**
 * Get all configs (admin)
 */
async function getAllConfigs() {
  try {
    const result = await db.query('SELECT * FROM remote_config ORDER BY category, key');
    return result.rows;
  } catch (err) {
    log.error('Failed to get all configs', { error: err.message });
    throw err;
  }
}

/**
 * Get config by key
 */
async function getConfigByKey(key) {
  try {
    const result = await db.query('SELECT * FROM remote_config WHERE key = $1', [key]);
    return result.rows[0] || null;
  } catch (err) {
    log.error('Failed to get config by key', { key, error: err.message });
    throw err;
  }
}

/**
 * Update config (admin)
 */
async function updateConfig(key, value, adminId) {
  try {
    const result = await db.query(
      `UPDATE remote_config
       SET value = $1::jsonb, last_modified_by = $2, last_modified_at = NOW(), version = version + 1
       WHERE key = $3 RETURNING *`,
      [typeof value === 'string' ? value : JSON.stringify(value), adminId, key]
    );
    return result.rows[0];
  } catch (err) {
    log.error('Failed to update config', { key, error: err.message });
    throw err;
  }
}

/**
 * Create config (admin)
 */
async function createConfig(data) {
  try {
    const result = await db.query(
      `INSERT INTO remote_config (key, value, value_type, category, label, description, tier_values, is_sensitive)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.key, typeof data.value === 'string' ? data.value : JSON.stringify(data.value),
       data.value_type, data.category, data.label, data.description || '',
       data.tier_values ? JSON.stringify(data.tier_values) : null, data.is_sensitive || false]
    );
    return result.rows[0];
  } catch (err) {
    log.error('Failed to create config', { key: data.key, error: err.message });
    throw err;
  }
}

/**
 * Get config change log
 */
async function getConfigLogs(limit = 50) {
  try {
    const result = await db.query(
      `SELECT key, value, version, last_modified_by, last_modified_at
       FROM remote_config ORDER BY last_modified_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    log.error('Failed to get config logs', { error: err.message });
    throw err;
  }
}

module.exports = {
  init,
  getConfigForTier,
  getConfigVersion,
  getAllConfigs,
  getConfigByKey,
  updateConfig,
  createConfig,
  getConfigLogs,
};
