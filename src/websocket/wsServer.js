'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getClient } = require('../config/redis');
const logger = require('../utils/logger');
const { handleConnection } = require('./handlers/connection.handler');
const { handlePresence } = require('./handlers/presence.handler');
const { handleLocation } = require('./handlers/location.handler');

let io = null;

/**
 * Verify JWT from handshake auth token.
 * @param {object} socket - Socket.IO socket
 * @param {Function} next - Middleware callback
 */
function authMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('WebSocket connection rejected: no token provided', {
        ip: socket.handshake.address,
      });
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.sub || decoded.userId || decoded.id;
    socket.userRole = decoded.role || 'user';

    if (!socket.userId) {
      logger.warn('WebSocket connection rejected: invalid token payload');
      return next(new Error('Invalid token payload'));
    }

    logger.info('WebSocket authenticated', { userId: socket.userId });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('WebSocket connection rejected: token expired', {
        ip: socket.handshake.address,
      });
      return next(new Error('Token expired'));
    }
    logger.warn('WebSocket connection rejected: auth failed', {
      error: err.message,
      ip: socket.handshake.address,
    });
    return next(new Error('Authentication failed'));
  }
}

/**
 * Initialize Socket.IO on the given HTTP server with Redis adapter
 * for horizontal scaling.
 *
 * @param {import('http').Server} server - HTTP server instance
 * @returns {Promise<import('socket.io').Server>}
 */
async function initWebSocket(server) {
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 10000,
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6,
    connectTimeout: 10000,
    allowEIO3: false,
  });

  // Attach Redis adapter for horizontal scaling
  try {
    const redisClient = getClient();
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([
      new Promise((resolve, reject) => {
        pubClient.once('ready', resolve);
        pubClient.once('error', reject);
      }),
      new Promise((resolve, reject) => {
        subClient.once('ready', resolve);
        subClient.once('error', reject);
      }),
    ]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter initialized');
  } catch (err) {
    logger.warn('Socket.IO Redis adapter failed to initialize, falling back to in-memory adapter', {
      error: err.message,
    });
  }

  // Auth middleware
  io.use(authMiddleware);

  // Connection handler
  io.on('connection', (socket) => {
    logger.info('Client connected', {
      socketId: socket.id,
      userId: socket.userId,
      transport: socket.conn.transport.name,
    });

    // Register all handlers
    handleConnection(io, socket);
    handlePresence(io, socket);
    handleLocation(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
      });
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Get the Socket.IO server instance.
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initWebSocket first.');
  }
  return io;
}

module.exports = { initWebSocket, getIO };
