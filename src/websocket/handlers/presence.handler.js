'use strict';

const { getClient } = require('../../config/redis');
const logger = require('../../utils/logger');

const ONLINE_KEY_PREFIX = 'colony:online:';

/**
 * Register presence-related socket events and expose helper functions.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function handlePresence(io, socket) {
  const userId = socket.userId;

  // Client can request the online status of other users
  socket.on('presence:check', async (data, callback) => {
    try {
      const { userIds } = data;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return callback({ error: 'userIds array is required' });
      }
      if (userIds.length > 100) {
        return callback({ error: 'Maximum 100 users per request' });
      }
      const statuses = await getBulkOnlineStatus(userIds);
      callback({ statuses });
    } catch (err) {
      logger.error('presence:check error', { userId, error: err.message });
      callback({ error: 'Internal error' });
    }
  });

  // Client can request the current online count
  socket.on('presence:count', async (data, callback) => {
    try {
      const count = await getOnlineCount();
      callback({ count });
    } catch (err) {
      logger.error('presence:count error', { userId, error: err.message });
      callback({ error: 'Internal error' });
    }
  });
}

/**
 * Check if a single user is online.
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function getOnlineStatus(userId) {
  const redis = getClient();
  const key = `${ONLINE_KEY_PREFIX}${userId}`;
  const result = await redis.get(key);
  return result === '1';
}

/**
 * Batch-check online status for multiple users using Redis pipeline.
 *
 * @param {string[]} userIds
 * @returns {Promise<Object<string, boolean>>}
 */
async function getBulkOnlineStatus(userIds) {
  const redis = getClient();
  const pipeline = redis.pipeline();

  for (const uid of userIds) {
    pipeline.get(`${ONLINE_KEY_PREFIX}${uid}`);
  }

  const results = await pipeline.exec();
  const statuses = {};

  for (let i = 0; i < userIds.length; i++) {
    const [err, value] = results[i];
    statuses[userIds[i]] = !err && value === '1';
  }

  return statuses;
}

/**
 * Broadcast a presence change event to relevant rooms.
 * "relevant" = rooms where the user is known (personal rooms of followers would
 * typically be handled by a notification layer; here we emit to a global topic).
 *
 * @param {string} userId
 * @param {'online'|'offline'} status
 */
async function broadcastPresenceChange(userId, status) {
  try {
    const { getIO } = require('../wsServer');
    const io = getIO();

    // Emit to the user's own room so connected devices know
    io.to(`user:${userId}`).emit('presence:changed', {
      userId,
      status,
      timestamp: Date.now(),
    });

    // Emit to a global presence room that clients can subscribe to
    io.emit('presence:update', {
      userId,
      status,
      timestamp: Date.now(),
    });

    logger.debug('Presence change broadcast', { userId, status });
  } catch (err) {
    // getIO() throws if not initialised yet -- safe to swallow during startup
    logger.debug('Could not broadcast presence change', { userId, error: err.message });
  }
}

/**
 * Get the approximate count of online users.
 * Uses SCAN to count keys matching the online prefix.
 *
 * @returns {Promise<number>}
 */
async function getOnlineCount() {
  const redis = getClient();
  let count = 0;
  let cursor = '0';

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${ONLINE_KEY_PREFIX}*`,
      'COUNT',
      200
    );
    cursor = nextCursor;
    count += keys.length;
  } while (cursor !== '0');

  return count;
}

module.exports = {
  handlePresence,
  getOnlineStatus,
  getBulkOnlineStatus,
  broadcastPresenceChange,
  getOnlineCount,
};
