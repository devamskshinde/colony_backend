'use strict';

const logger = require('../utils/logger');

const log = logger.child({ service: 'cache' });

const NAMESPACE = 'colony:';

/**
 * Cache service - wrapper around Redis client with "colony:" namespace.
 *
 * Expects a Redis client (ioredis-compatible) to be injected via init(redisClient)
 * before any methods are called. If no client is set, methods log errors and
 * return fallback values gracefully.
 */

let redisClient = null;

/**
 * Initialize the cache service with a Redis client.
 * @param {import('ioredis').Redis} client
 */
function init(client) {
  redisClient = client;
  log.info('Cache service initialized');
}

/**
 * Assert that Redis is connected. Returns true if available.
 */
function isReady() {
  if (!redisClient) {
    log.warn('Redis client not initialized');
    return false;
  }
  return true;
}

/**
 * Prefixed key helper.
 */
function ns(key) {
  return `${NAMESPACE}${key}`;
}

// ---------------------------------------------------------------------------
// Basic key/value
// ---------------------------------------------------------------------------

async function get(key) {
  if (!isReady()) return null;
  try {
    return await redisClient.get(ns(key));
  } catch (err) {
    log.error('Redis GET failed', { key, error: err.message });
    return null;
  }
}

async function set(key, value, ttl) {
  if (!isReady()) return;
  try {
    const k = ns(key);
    if (ttl) {
      await redisClient.set(k, value, 'EX', ttl);
    } else {
      await redisClient.set(k, value);
    }
  } catch (err) {
    log.error('Redis SET failed', { key, error: err.message });
  }
}

async function del(key) {
  if (!isReady()) return;
  try {
    await redisClient.del(ns(key));
  } catch (err) {
    log.error('Redis DEL failed', { key, error: err.message });
  }
}

async function exists(key) {
  if (!isReady()) return false;
  try {
    return (await redisClient.exists(ns(key))) === 1;
  } catch (err) {
    log.error('Redis EXISTS failed', { key, error: err.message });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hash operations
// ---------------------------------------------------------------------------

async function getHash(key, field) {
  if (!isReady()) return null;
  try {
    return await redisClient.hget(ns(key), field);
  } catch (err) {
    log.error('Redis HGET failed', { key, field, error: err.message });
    return null;
  }
}

async function setHash(key, field, value) {
  if (!isReady()) return;
  try {
    await redisClient.hset(ns(key), field, value);
  } catch (err) {
    log.error('Redis HSET failed', { key, field, error: err.message });
  }
}

async function getHashAll(key) {
  if (!isReady()) return null;
  try {
    return await redisClient.hgetall(ns(key));
  } catch (err) {
    log.error('Redis HGETALL failed', { key, error: err.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Set operations
// ---------------------------------------------------------------------------

async function addToSet(key, member) {
  if (!isReady()) return;
  try {
    await redisClient.sadd(ns(key), member);
  } catch (err) {
    log.error('Redis SADD failed', { key, member, error: err.message });
  }
}

async function getSetMembers(key) {
  if (!isReady()) return [];
  try {
    return await redisClient.smembers(ns(key));
  } catch (err) {
    log.error('Redis SMEMBERS failed', { key, error: err.message });
    return [];
  }
}

async function removeFromSet(key, member) {
  if (!isReady()) return;
  try {
    await redisClient.srem(ns(key), member);
  } catch (err) {
    log.error('Redis SREM failed', { key, member, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Geo operations
// ---------------------------------------------------------------------------

async function geoAdd(key, lng, lat, member) {
  if (!isReady()) return;
  try {
    await redisClient.geoadd(ns(key), lng, lat, member);
  } catch (err) {
    log.error('Redis GEOADD failed', { key, member, error: err.message });
  }
}

async function geoRadius(key, lng, lat, radiusM) {
  if (!isReady()) return [];
  try {
    return await redisClient.georadius(
      ns(key),
      lng,
      lat,
      radiusM,
      'm',
      'WITHDIST',
      'ASC'
    );
  } catch (err) {
    log.error('Redis GEORADIUS failed', { key, error: err.message });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Counter operations
// ---------------------------------------------------------------------------

async function incr(key, ttl) {
  if (!isReady()) return 0;
  try {
    const k = ns(key);
    const val = await redisClient.incr(k);
    if (ttl && val === 1) {
      await redisClient.expire(k, ttl);
    }
    return val;
  } catch (err) {
    log.error('Redis INCR failed', { key, error: err.message });
    return 0;
  }
}

async function getCounter(key) {
  if (!isReady()) return 0;
  try {
    const val = await redisClient.get(ns(key));
    return parseInt(val, 10) || 0;
  } catch (err) {
    log.error('Redis GET counter failed', { key, error: err.message });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

async function batchGet(keys) {
  if (!isReady()) return keys.map(() => null);
  try {
    const namespaced = keys.map(ns);
    const results = await redisClient.mget(...namespaced);
    return results;
  } catch (err) {
    log.error('Redis MGET failed', { keys, error: err.message });
    return keys.map(() => null);
  }
}

async function batchSet(keyValuePairs, ttl) {
  if (!isReady()) return;
  try {
    const pipeline = redisClient.pipeline();
    for (const [key, value] of Object.entries(keyValuePairs)) {
      const k = ns(key);
      if (ttl) {
        pipeline.set(k, value, 'EX', ttl);
      } else {
        pipeline.set(k, value);
      }
    }
    await pipeline.exec();
  } catch (err) {
    log.error('Redis batch SET failed', { error: err.message });
  }
}

module.exports = {
  init,
  get,
  set,
  del,
  exists,
  getHash,
  setHash,
  getHashAll,
  addToSet,
  getSetMembers,
  removeFromSet,
  geoAdd,
  geoRadius,
  incr,
  getCounter,
  batchGet,
  batchSet,
};
