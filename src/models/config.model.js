'use strict';

const db = require('../config/database');

/**
 * Fetch all remote config entries ordered by category and key.
 * @returns {Array} All config rows.
 */
async function findAll() {
  const { rows } = await db.query(
    'SELECT * FROM remote_config ORDER BY category, key'
  );
  return rows;
}

/**
 * Fetch a single config entry by key.
 * @param {string} key - Config key.
 * @returns {Object|null} The config row or null.
 */
async function findByKey(key) {
  const { rows } = await db.query(
    'SELECT * FROM remote_config WHERE key = $1',
    [key]
  );
  return rows[0] || null;
}

/**
 * Update a config entry's value.
 * Increments version and records the admin who made the change.
 * @param {string} key - Config key.
 * @param {*} value - New value (will be JSON-stringified if object).
 * @param {string} adminId - Id of the admin making the change.
 * @returns {Object|null} The updated config row.
 */
async function update(key, value, adminId) {
  const sql = `
    UPDATE remote_config
    SET value = $1,
        last_modified_by = $2,
        last_modified_at = NOW(),
        version = version + 1
    WHERE key = $3
    RETURNING *
  `;
  const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
  const { rows } = await db.query(sql, [serializedValue, adminId, key]);
  return rows[0] || null;
}

/**
 * Create a new config entry.
 * @param {Object} configData - Config fields (key, value, category, description, etc.).
 * @returns {Object} The created config row.
 */
async function create(configData) {
  const fields = Object.keys(configData);
  const values = Object.values(configData);
  const placeholders = fields.map((_, i) => `$${i + 1}`);

  const sql = `
    INSERT INTO remote_config (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;
  const { rows } = await db.query(sql, values);
  return rows[0];
}

/**
 * Get the current max version across all config entries.
 * Useful for client-side cache invalidation checks.
 * @returns {number} The highest version number, or 0 if empty.
 */
async function getVersion() {
  const { rows } = await db.query(
    'SELECT MAX(version) AS max_version FROM remote_config'
  );
  return rows[0]?.max_version || 0;
}

/**
 * Get all distinct categories in the remote config.
 * @returns {Array<string>} Array of category strings.
 */
async function getCategories() {
  const { rows } = await db.query(
    'SELECT DISTINCT category FROM remote_config ORDER BY category'
  );
  return rows.map((r) => r.category);
}

module.exports = {
  findAll,
  findByKey,
  update,
  create,
  getVersion,
  getCategories,
};
