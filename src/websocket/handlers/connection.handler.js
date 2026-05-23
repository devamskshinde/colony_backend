'use strict';

const { getClient } = require('../../config/redis');
const logger = require('../../utils/logger');

const ONLINE_KEY_PREFIX = 'colony:online:';
const ONLINE_TTL_SECONDS = 30;

/**
 * Handle WebSocket connection lifecycle.
 * - On connect: add user to online set with TTL
 * - On disconnect: remove from online, update last_active_at
 * - Heartbeat: extend TTL on ping
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function handleConnection(io, socket) {
  const userId = socket.userId;
  const redis = getClient();

  // Register user as online
  markOnline(redis, userId, socket).catch((err) => {
    logger.error('Failed to mark user online on connect', { userId, error: err.message });
  });

  // ── Heartbeat: client sends "ping" every 25s, server responds "pong" ──
  socket.on('ping', (callback) => {
    extendOnlineTTL(redis, userId).catch((err) => {
      logger.error('Failed to extend online TTL on heartbeat', { userId, error: err.message });
    });
    if (typeof callback === 'function') {
      callback({ status: 'pong', timestamp: Date.now() });
    } else {
      socket.emit('pong', { timestamp: Date.now() });
    }
  });

  // ── Disconnect ──
  socket.on('disconnect', async (reason) => {
    try {
      // Check if this was the last socket for this user
      const socketsInRoom = await io.in(`user:${userId}`).fetchSockets();
      // If no other sockets remain, mark offline
      if (socketsInRoom.length === 0) {
        await markOffline(redis, userId);
      }
    } catch (err) {
      logger.error('Error during disconnect cleanup', { userId, error: err.message });
    }
  });
}

/**
 * Add user to the online set in Redis with a 30-second TTL.
 * Also join the user's personal room for targeted events.
 *
 * @param {import('ioredis').Redis} redis
 * @param {string} userId
 * @param {import('socket.io').Socket} socket
 */
async function markOnline(redis, userId, socket) {
  const key = `${ONLINE_KEY_PREFIX}${userId}`;

  await redis.set(key, '1', 'EX', ONLINE_TTL_SECONDS);

  // Join personal room for targeted events
  socket.join(`user:${userId}`);

  logger.info('User marked online', { userId });
}

/**
 * Remove user from the online set and update last_active_at.
 *
 * @param {import('ioredis').Redis} redis
 * @param {string} userId
 */
async function markOffline(redis, userId) {
  const key = `${ONLINE_KEY_PREFIX}${userId}`;

  await redis.del(key);

  // Update last_active_at in database (fire-and-forget)
  try {
    const { query } = require('../../config/database');
    await query(
      'UPDATE users SET last_active_at = NOW() WHERE id = $1',
      [userId]
    );
  } catch (err) {
    logger.error('Failed to update last_active_at on disconnect', {
      userId,
      error: err.message,
    });
  }

  logger.info('User marked offline', { userId });
}

/**
 * Extend the online TTL for a user (heartbeat).
 *
 * @param {import('ioredis').Redis} redis
 * @param {string} userId
 */
async function extendOnlineTTL(redis, userId) {
  const key = `${ONLINE_KEY_PREFIX}${userId}`;
  await redis.expire(key, ONLINE_TTL_SECONDS);
}

module.exports = { handleConnection };
