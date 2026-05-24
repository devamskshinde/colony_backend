'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { pool } = require('./config/database');
const redis = require('./config/redis');
const { initWebSocket } = require('./websocket/wsServer');
const { startWorkers, stopWorkers } = require('./workers');
const remoteConfigService = require('./services/remoteConfig.service');
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

    // 3. Load remote config
    await remoteConfigService.loadAllConfig();
    logger.info('Remote config loaded');

    // 4. HTTP server
    server = http.createServer(app);

    // 5. WebSocket
    initWebSocket(server);
    logger.info('WebSocket initialized');

    // 6. Workers
    startWorkers();
    logger.info('Workers started');

    // 7. Listen
    server.listen(env.PORT, env.HOST, () => {
      logger.info(`Server running on ${env.HOST}:${env.PORT}`);
    });

    // 8. Graceful shutdown
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
