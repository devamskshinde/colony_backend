'use strict';

const { getClient } = require('../../config/redis');
const logger = require('../../utils/logger');
const { encode: encodeGeohash } = require('../../utils/geohash.utils');
const { joinCellRoom, leaveCellRoom, broadcastToCell } = require('../rooms/locationRoom');

/**
 * Register location-related socket events.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function handleLocation(io, socket) {
  const userId = socket.userId;

  // ── location_update ──────────────────────────────────────────────────────
  socket.on('location_update', async (data, callback) => {
    try {
      const { latitude, longitude, accuracy, heading, speed, timestamp } = data;

      // Validate payload
      if (!isValidLocationPayload(data)) {
        return sendError(callback, 'Invalid location payload: latitude (-90..90) and longitude (-180..180) required');
      }

      const geoHash5 = encodeGeohash(latitude, longitude, 5);

      // Update Redis geo index
      const redis = getClient();
      await redis.geoadd('colony:users:geo', longitude, latitude, userId);

      // Store latest location in Redis for fast reads
      await redis.set(
        `colony:location:${userId}`,
        JSON.stringify({ latitude, longitude, accuracy, heading, speed, geohash: geoHash5, timestamp: timestamp || Date.now() }),
        'EX',
        300 // 5-minute TTL, refreshed on next update
      );

      // Queue for async PostgreSQL write
      await redis.lpush(
        'colony:location:queue',
        JSON.stringify({
          userId,
          latitude,
          longitude,
          accuracy,
          heading,
          speed,
          geohash: geoHash5,
          timestamp: timestamp || Date.now(),
        })
      );

      // Join / update cell room
      const currentGeohash = socket.currentGeohash;
      if (currentGeohash !== geoHash5) {
        if (currentGeohash) {
          leaveCellRoom(socket, currentGeohash);
        }
        joinCellRoom(socket, geoHash5);
        socket.currentGeohash = geoHash5;
      }

      // Broadcast to all users in the same geohash cell
      broadcastToCell(io, geoHash5, 'user:location', {
        userId,
        latitude,
        longitude,
        accuracy,
        timestamp: timestamp || Date.now(),
      });

      if (typeof callback === 'function') {
        callback({ status: 'ok', geohash: geoHash5 });
      }
    } catch (err) {
      logger.error('location_update error', { userId, error: err.message });
      sendError(callback, 'Failed to process location update');
    }
  });

  // ── enter_area ───────────────────────────────────────────────────────────
  socket.on('enter_area', async (data, callback) => {
    try {
      const { geohash } = data;
      if (!geohash || typeof geohash !== 'string' || geohash.length < 4 || geohash.length > 6) {
        return sendError(callback, 'Valid geohash (4-6 chars) required');
      }

      const currentGeohash = socket.currentGeohash;
      if (currentGeohash) {
        leaveCellRoom(socket, currentGeohash);
      }

      joinCellRoom(socket, geohash);
      socket.currentGeohash = geohash;

      logger.info('User entered area', { userId, geohash });

      if (typeof callback === 'function') {
        callback({ status: 'ok', geohash });
      }
    } catch (err) {
      logger.error('enter_area error', { userId, error: err.message });
      sendError(callback, 'Failed to enter area');
    }
  });

  // ── leave_area ───────────────────────────────────────────────────────────
  socket.on('leave_area', async (data, callback) => {
    try {
      const { geohash } = data;
      const targetGeohash = geohash || socket.currentGeohash;

      if (!targetGeohash) {
        return sendError(callback, 'No area to leave');
      }

      leaveCellRoom(socket, targetGeohash);
      if (socket.currentGeohash === targetGeohash) {
        socket.currentGeohash = null;
      }

      logger.info('User left area', { userId, geohash: targetGeohash });

      if (typeof callback === 'function') {
        callback({ status: 'ok' });
      }
    } catch (err) {
      logger.error('leave_area error', { userId, error: err.message });
      sendError(callback, 'Failed to leave area');
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate a location payload.
 * @param {object} data
 * @returns {boolean}
 */
function isValidLocationPayload(data) {
  if (!data || typeof data !== 'object') return false;
  const { latitude, longitude } = data;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

/**
 * Send an error to the callback if it exists, otherwise emit an error event.
 */
function sendError(callback, message) {
  if (typeof callback === 'function') {
    callback({ error: message });
  }
}

module.exports = { handleLocation };
