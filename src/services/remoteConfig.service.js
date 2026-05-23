'use strict';

const logger = require('../utils/logger');

const log = logger.child({ service: 'remoteConfig' });

const CONFIG_HASH_KEY = 'config:all';
const CONFIG_VERSION_KEY = 'config:version';
const MAINTENANCE_KEY = 'config:maintenance';

/**
 * Remote config service.
 *
 * Manages app configuration that can be updated at runtime without redeployment.
 * Supports tier-based values (e.g., free vs premium feature flags).
 *
 * Table expected: remote_config
 *   columns: id, key (unique), value, value_type ('static'|'tier'|'json'|'boolean'|'number'),
 *            tier_values (jsonb, e.g. {"free":"A","premium":"B"}),
 *            description, version, updated_by, updated_at, created_at
 *
 * Expects:
 *   - db (pg.Pool)         via init(opts)
 *   - cacheService         via init(opts)
 */

let db = null;
let cache = null;

/**
 * Initialize the remote config service.
 * @param {object} opts
 * @param {import('pg').Pool} opts.db
 * @param {object} opts.cache - cache service instance
 */
function init(opts) {
  db = opts.db;
  cache = opts.cache;
  log.info('Remote config service initialized');
}

function assertInit() {
  if (!db) throw new Error('Remote config service not initialized: missing db');
  if (!cache) throw new Error('Remote config service not initialized: missing cache');
}

// ---------------------------------------------------------------------------
// Tier value resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a config value based on value_type and user tier.
 *
 * @param {object} configRow - Row from remote_config table
 * @param {string} [userTier='free'] - User tier
 * @returns {*} - Resolved value
 */
function resolveValue(configRow, userTier = 'free') {
  if (!configRow) return undefined;

  const { value, value_type, tier_values } = configRow;

  switch (value_type) {
    case 'tier': {
      if (!tier_values) return value;
      // tier_values is stored as JSON: { "free": "...", "premium": "...", ... }
      const parsed = typeof tier_values === 'string' ? JSON.parse(tier_values) : tier_values;
      return parsed[userTier] !== undefined ? parsed[userTier] : parsed.default ?? value;
    }
    case 'json': {
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return value;
      }
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      return value === 'true' || value === '1';
    }
    case 'number': {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    case 'static':
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all config rows from DB into Redis.
 * Called on startup to warm the cache.
 */
async function loadAllConfig() {
  assertInit();

  try {
    const result = await db.query(
      'SELECT key, value, value_type, tier_values, version FROM remote_config ORDER BY key'
    );

    const rows = result.rows;

    // Build hash: key -> JSON-serialized row
    const hashData = {};
    let maxVersion = 0;

    for (const row of rows) {
      hashData[row.key] = JSON.stringify({
        value: row.value,
        value_type: row.value_type,
        tier_values: row.tier_values,
      });
      if (row.version > maxVersion) maxVersion = row.version;
    }

    // Store each field individually via cache service
    for (const [field, val] of Object.entries(hashData)) {
      await cache.setHash(CONFIG_HASH_KEY, field, val);
    }

    // Set version
    await cache.set(CONFIG_VERSION_KEY, String(maxVersion || 1));

    // Check for maintenance mode flag
    const maintenanceRow = rows.find((r) => r.key === 'maintenance_mode');
    if (maintenanceRow) {
      const isMaintenance = resolveValue(maintenanceRow) === true ||
                            resolveValue(maintenanceRow) === 'true' ||
                            resolveValue(maintenanceRow) === '1';
      await cache.set(MAINTENANCE_KEY, isMaintenance ? '1' : '0');
    }

    log.info('Remote config loaded into cache', { count: rows.length, version: maxVersion });
  } catch (err) {
    log.error('Failed to load remote config', { error: err.message });
    throw err;
  }
}

/**
 * Get a single config value by key, resolved for a user tier.
 *
 * @param {string} key - Config key
 * @param {string} [userTier='free']
 * @returns {Promise<*>} - Resolved value, or undefined if key not found
 */
async function getConfig(key, userTier = 'free') {
  assertInit();

  try {
    // Try Redis first
    const cached = await cache.getHash(CONFIG_HASH_KEY, key);
    if (cached) {
      const parsed = JSON.parse(cached);
      return resolveValue(parsed, userTier);
    }

    // Fallback to DB
    const result = await db.query(
      'SELECT key, value, value_type, tier_values FROM remote_config WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) return undefined;

    const row = result.rows[0];

    // Warm cache
    await cache.setHash(CONFIG_HASH_KEY, key, JSON.stringify({
      value: row.value,
      value_type: row.value_type,
      tier_values: row.tier_values,
    }));

    return resolveValue(row, userTier);
  } catch (err) {
    log.error('Failed to get config', { key, error: err.message });
    throw err;
  }
}

/**
 * Get all config keys with their tier-resolved values.
 *
 * @param {string} [userTier='free']
 * @returns {Promise<object>} - { key: resolvedValue, ... }
 */
async function getAllConfig(userTier = 'free') {
  assertInit();

  try {
    // Try Redis first
    const hashAll = await cache.getHashAll(CONFIG_HASH_KEY);

    if (hashAll && Object.keys(hashAll).length > 0) {
      const resolved = {};
      for (const [key, serialized] of Object.entries(hashAll)) {
        try {
          const parsed = JSON.parse(serialized);
          resolved[key] = resolveValue(parsed, userTier);
        } catch {
          resolved[key] = serialized;
        }
      }
      return resolved;
    }

    // Fallback to DB
    const result = await db.query(
      'SELECT key, value, value_type, tier_values FROM remote_config ORDER BY key'
    );

    const resolved = {};
    for (const row of result.rows) {
      resolved[row.key] = resolveValue(row, userTier);
      // Warm cache
      await cache.setHash(CONFIG_HASH_KEY, row.key, JSON.stringify({
        value: row.value,
        value_type: row.value_type,
        tier_values: row.tier_values,
      }));
    }

    return resolved;
  } catch (err) {
    log.error('Failed to get all config', { error: err.message });
    throw err;
  }
}

/**
 * Update a config value (admin action).
 *
 * 1. Update DB row
 * 2. Update Redis hash
 * 3. Increment version in both DB and Redis
 * 4. Log admin action
 *
 * @param {string} key
 * @param {*} value
 * @param {string} adminId
 */
async function updateConfig(key, value, adminId) {
  assertInit();

  try {
    // Get current version
    const currentVersion = await getConfigVersion();
    const newVersion = currentVersion + 1;

    // Update DB
    const result = await db.query(
      `UPDATE remote_config
       SET value = $1, version = $2, updated_by = $3, updated_at = NOW()
       WHERE key = $4
       RETURNING key, value, value_type, tier_values, version`,
      [String(value), newVersion, adminId, key]
    );

    if (result.rows.length === 0) {
      const err = new Error(`Config key "${key}" not found`);
      err.statusCode = 404;
      throw err;
    }

    const row = result.rows[0];

    // Update Redis cache
    await cache.setHash(CONFIG_HASH_KEY, key, JSON.stringify({
      value: row.value,
      value_type: row.value_type,
      tier_values: row.tier_values,
    }));

    // Update version
    await cache.set(CONFIG_VERSION_KEY, String(newVersion));
    await db.query('UPDATE remote_config SET version = $1 WHERE key = \'__version_counter\'', [newVersion]);

    // Special handling for maintenance mode
    if (key === 'maintenance_mode') {
      const isMaintenance = resolveValue(row) === true ||
                            resolveValue(row) === 'true' ||
                            resolveValue(row) === '1';
      await cache.set(MAINTENANCE_KEY, isMaintenance ? '1' : '0');
    }

    log.info('Config updated', { key, adminId, newVersion });
  } catch (err) {
    log.error('Failed to update config', { key, adminId, error: err.message });
    throw err;
  }
}

/**
 * Get the current config version from Redis (fallback to DB).
 * @returns {Promise<number>}
 */
async function getConfigVersion() {
  assertInit();

  try {
    const cached = await cache.get(CONFIG_VERSION_KEY);
    if (cached) return parseInt(cached, 10) || 1;

    // Fallback: query DB for max version
    const result = await db.query('SELECT COALESCE(MAX(version), 1)::int AS v FROM remote_config');
    const version = result.rows[0].v || 1;
    await cache.set(CONFIG_VERSION_KEY, String(version));
    return version;
  } catch (err) {
    log.error('Failed to get config version', { error: err.message });
    return 1;
  }
}

/**
 * Quick check: is the app in maintenance mode?
 * Reads directly from Redis for speed.
 * @returns {Promise<boolean>}
 */
async function isMaintenanceMode() {
  try {
    const val = await cache.get(MAINTENANCE_KEY);
    return val === '1';
  } catch (err) {
    log.error('Failed to check maintenance mode', { error: err.message });
    return false;
  }
}

module.exports = {
  init,
  loadAllConfig,
  getConfig,
  getAllConfig,
  updateConfig,
  getConfigVersion,
  isMaintenanceMode,
};
