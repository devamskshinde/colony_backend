'use strict';

const { getClient } = require('../../config/redis');
const logger = require('../../utils/logger');

const CELL_ROOM_PREFIX = 'cell:';
const CELL_MEMBERS_PREFIX = 'colony:cell:members:';

/**
 * Join a socket to a geohash cell room.
 *
 * @param {import('socket.io').Socket} socket
 * @param {string} geohash
 */
function joinCellRoom(socket, geohash) {
  const roomName = `${CELL_ROOM_PREFIX}${geohash}`;
  socket.join(roomName);

  // Track membership in Redis for cross-server lookups
  const redis = getClient();
  redis.sadd(`${CELL_MEMBERS_PREFIX}${geohash}`, socket.userId).catch((err) => {
    logger.error('Failed to add user to cell members set', {
      userId: socket.userId,
      geohash,
      error: err.message,
    });
  });

  logger.debug('Socket joined cell room', {
    socketId: socket.id,
    userId: socket.userId,
    geohash,
    room: roomName,
  });
}

/**
 * Remove a socket from a geohash cell room.
 *
 * @param {import('socket.io').Socket} socket
 * @param {string} geohash
 */
function leaveCellRoom(socket, geohash) {
  const roomName = `${CELL_ROOM_PREFIX}${geohash}`;
  socket.leave(roomName);

  // Remove from Redis set
  const redis = getClient();
  redis.srem(`${CELL_MEMBERS_PREFIX}${geohash}`, socket.userId).catch((err) => {
    logger.error('Failed to remove user from cell members set', {
      userId: socket.userId,
      geohash,
      error: err.message,
    });
  });

  logger.debug('Socket left cell room', {
    socketId: socket.id,
    userId: socket.userId,
    geohash,
    room: roomName,
  });
}

/**
 * Broadcast an event to all sockets in a geohash cell room.
 *
 * @param {import('socket.io').Server} io
 * @param {string} geohash
 * @param {string} event
 * @param {object} data
 */
function broadcastToCell(io, geohash, event, data) {
  const roomName = `${CELL_ROOM_PREFIX}${geohash}`;
  io.to(roomName).emit(event, data);

  logger.debug('Broadcast to cell room', {
    room: roomName,
    event,
    userId: data?.userId,
  });
}

/**
 * Get the set of user IDs currently in a geohash cell.
 *
 * @param {string} geohash
 * @returns {Promise<string[]>}
 */
async function getCellMembers(geohash) {
  const redis = getClient();
  const members = await redis.smembers(`${CELL_MEMBERS_PREFIX}${geohash}`);
  return members;
}

module.exports = {
  joinCellRoom,
  leaveCellRoom,
  broadcastToCell,
  getCellMembers,
};
