'use strict';

const Redis = require('ioredis');
const logger = require('../utils/logger');

let client = null;
let subscriber = null;

function createRedisClient(role = 'main') {
  const options = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > 10) {
        logger.error('Redis max retries reached, giving up', { role });
        return null;
      }
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: false,
  };

  const redis = new Redis(options);

  redis.on('connect', () => {
    logger.info(`Redis ${role} connected`, { host: options.host, port: options.port });
  });

  redis.on('ready', () => {
    logger.info(`Redis ${role} ready`);
  });

  redis.on('error', (err) => {
    logger.error(`Redis ${role} error`, { error: err.message });
  });

  redis.on('close', () => {
    logger.warn(`Redis ${role} connection closed`);
  });

  return redis;
}

function getClient() {
  if (!client) {
    client = createRedisClient('main');
  }
  return client;
}

function getSubscriber() {
  if (!subscriber) {
    subscriber = createRedisClient('subscriber');
  }
  return subscriber;
}

async function closeAll() {
  const promises = [];
  if (client) {
    promises.push(client.quit().catch(() => client.disconnect()));
    client = null;
  }
  if (subscriber) {
    promises.push(subscriber.quit().catch(() => subscriber.disconnect()));
    subscriber = null;
  }
  await Promise.all(promises);
  logger.info('All Redis connections closed');
}

// Alias for backward compatibility with middleware that uses getRedisClient
const getRedisClient = getClient;

module.exports = { getClient, getRedisClient, getSubscriber, closeAll };
