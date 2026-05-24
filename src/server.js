'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { pool } = require('./config/database');
const redis = require('./config/redis');
const { initWebSocket } = require('./websocket/wsServer');
const { startWorkers, stopWorkers } = require('./workers');
const remoteConfigService = require('./services/remoteConfig.service');
const otpService = require('./services/otp.service');
const authService = require('./services/auth.service');
const locationService = require('./services/location.service');
const configService = require('./services/config.service');
const userService = require('./services/user.service');
const cacheService = require('./services/cache.service');
const logger = require('./utils/logger');
const env = require('./config/environment');

let server;

async function start() {
  try {
    // 1. Test database
    const dbClient = await pool.connect();
    logger.info('PostgreSQL connected');
    dbClient.release();

    // 2. Test Redis
    const redisClient = redis.getClient();
    await redisClient.ping();
    logger.info('Redis connected');

    // 3. Initialize ALL services with their dependencies
    cacheService.init(redisClient);
    remoteConfigService.init({ db: pool, cache: cacheService });
    otpService.init(pool);
    authService.init({ db: pool, cache: cacheService });
    locationService.init({ db: pool, cache: cacheService, queue: null });
    configService.init(pool);
    userService.init(pool);
    logger.info('All services initialized');

    // 4. Load remote config into Redis
    await remoteConfigService.loadAllConfig();
    logger.info('Remote config loaded');

    // 5. HTTP server
    server = http.createServer(app);

    // 6. WebSocket
    try {
      initWebSocket(server);
      logger.info('WebSocket initialized');
    } catch (err) {
      logger.warn('WebSocket init failed (non-fatal)', { error: err.message });
    }

    // 7. Workers
    startWorkers();
    logger.info('Workers started');

    // 8. Listen
    server.listen(env.PORT, env.HOST, () => {
      logger.info(`Server running on ${env.HOST}:${env.PORT}`);
    });

    // 9. Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down`);
      server.close(async () => {
        stopWorkers();
        await pool.end();
        await redis.closeAll();
        logger.info('Shutdown complete');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (r) => logger.error('Unhandled rejection', { reason: String(r) }));
    process.on('uncaughtException', (e) => { logger.error('Uncaught', { error: e.message }); process.exit(1); });
  } catch (err) {
    logger.error('Fatal startup error', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

start();
