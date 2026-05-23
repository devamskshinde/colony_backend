'use strict';

const logger = require('../utils/logger');

const log = logger.child({ service: 'location' });

/**
 * Geohash utility functions for cell calculations.
 * Precision 5 gives ~5km x 5km cells; precision 6 gives ~1.2km x 600m cells.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat, lng, precision = 5) {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latRange = [-90, 90];
  let lngRange = [-180, 180];

  while (geohash.length < precision) {
    if (evenBit) {
      // bisect longitude
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        idx = idx * 2 + 1;
        lngRange[0] = mid;
      } else {
        idx = idx * 2;
        lngRange[1] = mid;
      }
    } else {
      // bisect latitude
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latRange[0] = mid;
      } else {
        idx = idx * 2;
        latRange[1] = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Location service - manages user location in both PostgreSQL/PostGIS and Redis.
 *
 * Redis keys used:
 *   - colony:geo:active           (GEOSET of active users)
 *   - colony:user:location:{id}   (HASH with lat, lng, accuracy, geohash, updated_at)
 *   - colony:cell:members:{gh5}   (SET of user IDs in a geohash-5 cell)
 *
 * Expects:
 *   - db (pg.Pool)         via init(opts)
 *   - cacheService         via init(opts)
 *   - queueService         via init(opts)
 */

let db = null;
let cache = null;
let queue = null;

/**
 * Initialize the location service.
 * @param {object} opts
 * @param {import('pg').Pool} opts.db
 * @param {object} opts.cache - cache service instance
 * @param {object} opts.queue - queue service instance
 */
function init(opts) {
  db = opts.db;
  cache = opts.cache;
  queue = opts.queue;
  log.info('Location service initialized');
}

function assertInit() {
  if (!db) throw new Error('Location service not initialized: missing db');
  if (!cache) throw new Error('Location service not initialized: missing cache');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const GEO_ACTIVE_KEY = 'geo:active';
const USER_LOCATION_PREFIX = 'user:location';
const CELL_MEMBERS_PREFIX = 'cell:members';

function userLocationKey(userId) {
  return `${USER_LOCATION_PREFIX}:${userId}`;
}

function cellMembersKey(geohash) {
  return `${CELL_MEMBERS_PREFIX}:${geohash}`;
}

/**
 * Remove a user from their previous geohash cell set in Redis.
 */
async function removeOldCellMembership(userId) {
  try {
    const current = await cache.getHashAll(userLocationKey(userId));
    if (current && current.geohash) {
      await cache.removeFromSet(cellMembersKey(current.geohash), String(userId));
    }
  } catch (err) {
    log.warn('Failed to remove old cell membership', { userId, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update a user's location.
 *
 * 1. Update PostGIS current_location (POINT), current_geohash, location_updated_at in users table
 * 2. Redis: GEOADD colony:geo:active
 * 3. Redis: HSET colony:user:location:{id} with lat, lng, accuracy, geohash, updated_at
 * 4. Redis: SADD colony:cell:members:{geohash5} (remove from old cell first)
 * 5. Queue location history write (async)
 *
 * @param {string} userId
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @param {number} [accuracy] - GPS accuracy in meters
 */
async function updateLocation(userId, lat, lng, accuracy) {
  assertInit();

  try {
    const geohash5 = encodeGeohash(lat, lng, 5);
    const now = new Date().toISOString();

    // 1. Update database
    await db.query(
      `UPDATE users
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           current_geohash = $3,
           location_updated_at = NOW()
       WHERE id = $4`,
      [lng, lat, geohash5, userId]
    );

    // 2. Remove from old geohash cell, add to new one
    await removeOldCellMembership(userId);

    // 3. Redis: geo active set
    await cache.geoAdd(GEO_ACTIVE_KEY, lng, lat, String(userId));

    // 4. Redis: user location hash
    await cache.setHash(userLocationKey(userId), 'lat', String(lat));
    await cache.setHash(userLocationKey(userId), 'lng', String(lng));
    await cache.setHash(userLocationKey(userId), 'accuracy', String(accuracy || ''));
    await cache.setHash(userLocationKey(userId), 'geohash', geohash5);
    await cache.setHash(userLocationKey(userId), 'updated_at', now);

    // 5. Redis: geohash cell membership
    await cache.addToSet(cellMembersKey(geohash5), String(userId));

    // 6. Queue location history write (async, non-blocking)
    if (queue && queue.isConnected()) {
      await queue.publish('location_history', {
        userId,
        lat,
        lng,
        accuracy,
        geohash: geohash5,
        timestamp: now,
      });
    }

    log.debug('Location updated', { userId, lat, lng, geohash: geohash5 });
  } catch (err) {
    log.error('Failed to update location', { userId, error: err.message });
    throw err;
  }
}

/**
 * Get nearby users within a radius.
 *
 * Uses Redis GEORADIUS on colony:geo:active.
 * Filters out: blocked users, suspended users, ghost mode users.
 * Results sorted by distance.
 *
 * @param {string} userId - requesting user
 * @param {number} radiusKm - search radius in kilometers
 * @returns {Promise<Array<{userId: string, distance: number}>>}
 */
async function getNearbyUsers(userId, radiusKm) {
  assertInit();

  try {
    // Get requesting user's location
    const userLoc = await getUserLocation(userId);
    if (!userLoc || !userLoc.lat || !userLoc.lng) {
      log.warn('Cannot get nearby users: requesting user has no location', { userId });
      return [];
    }

    const lat = parseFloat(userLoc.lat);
    const lng = parseFloat(userLoc.lng);
    const radiusM = radiusKm * 1000;

    // Redis GEORADIUS
    const results = await cache.geoRadius(GEO_ACTIVE_KEY, lng, lat, radiusM);

    if (!results || results.length === 0) return [];

    // Get list of blocked user IDs for this user
    let blockedIds = new Set();
    try {
      const blockedResult = await db.query(
        'SELECT blocked_id FROM user_blocks WHERE blocker_id = $1',
        [userId]
      );
      blockedIds = new Set(blockedResult.rows.map((r) => String(r.blocked_id)));
    } catch (err) {
      log.warn('Could not fetch blocked users', { error: err.message });
    }

    // Get suspended and ghost-mode user IDs
    const nearbyUserIds = results
      .map((r) => r[0]) // r[0] = member (userId), r[1] = distance
      .filter((id) => id !== String(userId));

    let suspendedIds = new Set();
    let ghostIds = new Set();

    if (nearbyUserIds.length > 0) {
      try {
        const statusResult = await db.query(
          `SELECT id::text, status, ghost_mode FROM users WHERE id = ANY($1::text[])`,
          [nearbyUserIds]
        );
        for (const row of statusResult.rows) {
          if (row.status === 'suspended') suspendedIds.add(row.id);
          if (row.ghost_mode === true) ghostIds.add(row.id);
        }
      } catch (err) {
        log.warn('Could not fetch user statuses for nearby filter', { error: err.message });
      }
    }

    // Filter and sort
    const filtered = results
      .filter(([memberId]) => {
        if (memberId === String(userId)) return false;
        if (blockedIds.has(memberId)) return false;
        if (suspendedIds.has(memberId)) return false;
        if (ghostIds.has(memberId)) return false;
        return true;
      })
      .map(([memberId, distance]) => ({
        userId: memberId,
        distance: parseFloat(distance),
      }))
      .sort((a, b) => a.distance - b.distance);

    log.debug('Nearby users found', { userId, count: filtered.length, radiusKm });
    return filtered;
  } catch (err) {
    log.error('Failed to get nearby users', { userId, error: err.message });
    throw err;
  }
}

/**
 * Get a user's location (Redis first, DB fallback).
 *
 * @param {string} userId
 * @returns {Promise<{lat: string, lng: string, accuracy: string, geohash: string, updated_at: string} | null>}
 */
async function getUserLocation(userId) {
  assertInit();

  try {
    // Try Redis first
    const cached = await cache.getHashAll(userLocationKey(userId));
    if (cached && cached.lat && cached.lng) {
      return cached;
    }

    // Fallback to DB
    const result = await db.query(
      `SELECT
         ST_Y(current_location::geometry) AS lat,
         ST_X(current_location::geometry) AS lng,
         current_geohash AS geohash,
         location_updated_at AS updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (!row.lat || !row.lng) return null;

    const location = {
      lat: String(row.lat),
      lng: String(row.lng),
      accuracy: '',
      geohash: row.geohash || '',
      updated_at: row.updated_at ? row.updated_at.toISOString() : '',
    };

    // Warm Redis cache for next time
    await cache.setHash(userLocationKey(userId), 'lat', location.lat);
    await cache.setHash(userLocationKey(userId), 'lng', location.lng);
    await cache.setHash(userLocationKey(userId), 'geohash', location.geohash);
    await cache.setHash(userLocationKey(userId), 'updated_at', location.updated_at);

    return location;
  } catch (err) {
    log.error('Failed to get user location', { userId, error: err.message });
    throw err;
  }
}

/**
 * Remove a user's location from Redis and clear DB location fields.
 *
 * @param {string} userId
 */
async function removeLocation(userId) {
  assertInit();

  try {
    // Remove from old geohash cell
    await removeOldCellMembership(userId);

    // Remove from geo active set
    await cache.removeFromSet(GEO_ACTIVE_KEY, String(userId));

    // Delete location hash
    await cache.del(userLocationKey(userId));

    // Clear DB location
    await db.query(
      `UPDATE users
       SET current_location = NULL,
           current_geohash = NULL,
           location_updated_at = NULL
       WHERE id = $1`,
      [userId]
    );

    log.info('User location removed', { userId });
  } catch (err) {
    log.error('Failed to remove location', { userId, error: err.message });
    throw err;
  }
}

module.exports = {
  init,
  updateLocation,
  getNearbyUsers,
  getUserLocation,
  removeLocation,
  // Exported for testing / reuse
  encodeGeohash,
};
