'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Load environment variables before anything else
// ═══════════════════════════════════════════════════════════════════════════

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const { pool, query } = require('./config/database');
const redis = require('./config/redis');
const cacheService = require('./services/cache.service');
const remoteConfigService = require('./services/remoteConfig.service');
const otpService = require('./services/otp.service');
const authService = require('./services/auth.service');
const locationService = require('./services/location.service');
const configService = require('./services/config.service');
const userService = require('./services/user.service');
const { initWebSocket } = require('./websocket/wsServer');
const { startLocationSyncWorker, stopLocationSyncWorker } = require('./workers/locationSync.worker');
const { startCleanupWorker, stopCleanupWorker } = require('./workers/cleanup.worker');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

let server = null;

// ═══════════════════════════════════════════════════════════════════════════
// Boot sequence
// ═══════════════════════════════════════════════════════════════════════════

async function boot() {
  logger.info('Starting Colony backend server...', {
    env: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid,
  });

  // ── 1. Verify database connection (with retry) ─────────────────────
  let dbReady = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await query('SELECT 1');
      logger.info('PostgreSQL connection verified');
      dbReady = true;
      break;
    } catch (err) {
      logger.warn(`PostgreSQL attempt ${attempt}/10 failed: ${err.message}`);
      if (attempt < 10) await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!dbReady) {
    logger.error('Failed to connect to PostgreSQL after 10 attempts');
    logger.error('Check: DB_PASSWORD in .env matches the Docker container password');
    logger.error('Fix: ./setup.sh (will auto-detect and fix password mismatch)');
    process.exit(1);
  }

  // ── 2. Verify Redis connection (with retry) ─────────────────────────
  let redisReady = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const redisClient = redis.getClient();
      await redisClient.ping();
      logger.info('Redis connection verified');
      redisReady = true;
      break;
    } catch (err) {
      logger.warn(`Redis attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt < 5) await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!redisReady) {
    logger.error('Failed to connect to Redis after 5 attempts');
    logger.error('Check: REDIS_PASSWORD in .env matches the Docker container password');
    process.exit(1);
  }

  // ── 3. Initialize services and load remote config ───────────────────
  try {
    cacheService.init(redis.getClient());
    remoteConfigService.init({ db: pool, cache: cacheService });
    otpService.init(pool);
    authService.init(pool);
    locationService.init(pool);
    configService.init(pool);
    userService.init(pool);
    await remoteConfigService.loadAllConfig();
    logger.info('All services initialized, remote config loaded');
  } catch (err) {
    logger.warn('Failed to load remote config, continuing with defaults', {
      error: err.message,
    });
  }

  // ── 4. Create HTTP server ───────────────────────────────────────────
  server = http.createServer(app);

  // ── 5. Initialize WebSocket on the same server ──────────────────────
  try {
    await initWebSocket(server);
    logger.info('WebSocket server attached');
  } catch (err) {
    logger.error('Failed to initialize WebSocket server', { error: err.message });
    // Continue without WebSocket -- the REST API can still function
  }

  // ── 6. Start listening ──────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    server.listen(PORT, HOST, () => {
      logger.info(`Colony backend listening on ${HOST}:${PORT}`, {
        env: process.env.NODE_ENV || 'development',
      });
      resolve();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server listen error', { error: err.message });
      }
      reject(err);
    });
  });

  // ── 7. Start background workers ─────────────────────────────────────
  try {
    startLocationSyncWorker();
    startCleanupWorker();
    logger.info('Background workers started');
  } catch (err) {
    logger.error('Failed to start workers', { error: err.message });
  }

  logger.info('Colony backend fully started');
}

// ═══════════════════════════════════════════════════════════════════════════
// Graceful shutdown
// ═══════════════════════════════════════════════════════════════════════════

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring duplicate signal');
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30s, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // 1. Stop accepting new connections
    if (server) {
      await new Promise((resolve) => {
        server.close((err) => {
          if (err) {
            logger.error('Error closing HTTP server', { error: err.message });
          } else {
            logger.info('HTTP server closed');
          }
          resolve();
        });
      });
    }

    // 2. Stop workers
    try {
      stopLocationSyncWorker();
      stopCleanupWorker();
      logger.info('Workers stopped');
    } catch (err) {
      logger.error('Error stopping workers', { error: err.message });
    }

    // 3. Close database pool
    try {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { error: err.message });
    }

    // 4. Close Redis connections
    try {
      await redis.closeAll();
      logger.info('Redis connections closed');
    } catch (err) {
      logger.error('Error closing Redis', { error: err.message });
    }

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    clearTimeout(shutdownTimeout);
    logger.error('Error during graceful shutdown', { error: err.message });
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Process signal and error handlers
// ═══════════════════════════════════════════════════════════════════════════

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // In production, you might want to exit here:
  // process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    message: err.message,
    stack: err.stack,
  });
  // Uncaught exceptions leave the process in an unknown state -- exit
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// Run
// ═══════════════════════════════════════════════════════════════════════════

boot().catch((err) => {
  logger.error('Fatal error during boot', { error: err.message, stack: err.stack });
  process.exit(1);
});
