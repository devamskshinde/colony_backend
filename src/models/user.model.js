'use strict';

const db = require('../config/database');

/**
 * Find a user by their primary key id.
 * Returns the user row or null if not found.
 */
async function findById(id) {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Find a user by phone number.
 * Returns the user row or null if not found.
 */
async function findByPhone(phone) {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE phone = $1',
    [phone]
  );
  return rows[0] || null;
}

/**
 * Find a user by username (case-insensitive).
 * Returns the user row or null if not found.
 */
async function findByUsername(username) {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return rows[0] || null;
}

/**
 * Create a new user.
 * @param {Object} userData - User fields to insert.
 * @returns {Object} The created user row.
 */
async function create(userData) {
  const fields = Object.keys(userData);
  const values = Object.values(userData);
  const placeholders = fields.map((_, i) => `$${i + 1}`);

  const sql = `
    INSERT INTO users (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;
  const { rows } = await db.query(sql, values);
  return rows[0];
}

/**
 * Update a user with dynamic fields.
 * @param {string} id - User id.
 * @param {Object} fields - Key/value pairs to update.
 * @returns {Object|null} The updated user row, or null if not found.
 */
async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);

  const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
  const values = Object.values(fields);

  const sql = `
    UPDATE users
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE id = $${keys.length + 1}
    RETURNING *
  `;
  const { rows } = await db.query(sql, [...values, id]);
  return rows[0] || null;
}

/**
 * Update a user's current location using PostGIS.
 * @param {string} id - User id.
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @param {string} geohash - Geohash string.
 */
async function updateLocation(id, lat, lng, geohash) {
  const sql = `
    UPDATE users
    SET current_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
        current_geohash = $4,
        location_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [id, lng, lat, geohash]);
  return rows[0] || null;
}

/**
 * Update the user's last_active_at to now.
 */
async function updateLastActive(id) {
  const sql = `
    UPDATE users
    SET last_active_at = NOW()
    WHERE id = $1
    RETURNING id, last_active_at
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Search users by display_name or username using pg_trgm similarity.
 * @param {string} query - Search term.
 * @param {number} limit - Max results (default 20).
 * @returns {Array} Matching user rows.
 */
async function search(query, limit = 20) {
  const sql = `
    SELECT *,
           GREATEST(
             similarity(display_name, $1),
             similarity(username, $1)
           ) AS match_score
    FROM users
    WHERE is_deleted = false
      AND (
        similarity(display_name, $1) > 0.1
        OR similarity(username, $1) > 0.1
      )
    ORDER BY match_score DESC
    LIMIT $2
  `;
  const { rows } = await db.query(sql, [query, limit]);
  return rows;
}

/**
 * Find users near a given location using PostGIS.
 * @param {number} lat - Latitude of center point.
 * @param {number} lng - Longitude of center point.
 * @param {number} radiusKm - Search radius in kilometers.
 * @param {number} limit - Max results (default 50).
 * @returns {Array} Nearby user rows with distance.
 */
async function getNearby(lat, lng, radiusKm = 10, limit = 50) {
  const sql = `
    SELECT *,
           ST_Distance(
             current_location,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
           ) / 1000.0 AS distance_km
    FROM users
    WHERE is_deleted = false
      AND current_location IS NOT NULL
      AND ST_DWithin(
        current_location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3 * 1000
      )
    ORDER BY distance_km ASC
    LIMIT $4
  `;
  const { rows } = await db.query(sql, [lng, lat, radiusKm, limit]);
  return rows;
}

/**
 * Mark a user as online (update last_active_at).
 * Alias for updateLastActive.
 */
async function setOnline(id) {
  return updateLastActive(id);
}

/**
 * Soft-delete a user.
 * Sets is_deleted = true and deleted_at to now.
 * @param {string} id - User id.
 * @returns {Object|null} The soft-deleted user row.
 */
async function softDelete(id) {
  const sql = `
    UPDATE users
    SET is_deleted = true,
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

module.exports = {
  findById,
  findByPhone,
  findByUsername,
  create,
  update,
  updateLocation,
  updateLastActive,
  search,
  getNearby,
  setOnline,
  softDelete,
};
