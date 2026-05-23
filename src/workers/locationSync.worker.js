'use strict';

const cron = require('node-cron');
const { getClient } = require('../config/redis');
const { pool, query } = require('../config/database');
const logger = require('../utils/logger');

let scheduledTask = null;

/**
 * Start the location sync worker.
 * Runs every 5 minutes to:
 *   1. Batch-write queued location entries from Redis to PostgreSQL.
 *   2. Clean up stale Redis geo entries (users inactive > 30 minutes).
 */
function startLocationSyncWorker() {
  if (scheduledTask) {
    logger.warn('Location sync worker is already running');
    return;
  }

  scheduledTask = cron.schedule('*/5 * * * *', async () => {
    const runId = Date.now();
    logger.info('Location sync worker started', { runId });

    try {
      await flushLocationQueue(runId);
      await cleanStaleGeoEntries(runId);
      logger.info('Location sync worker completed', { runId });
    } catch (err) {
      logger.error('Location sync worker failed', { runId, error: err.message, stack: err.stack });
    }
  });

  logger.info('Location sync worker scheduled (every 5 minutes)');
}

/**
 * Drain the Redis location queue and batch-insert into PostgreSQL.
 *
 * @param {number} runId - Identifier for this run (for log correlation)
 */
async function flushLocationQueue(runId) {
  const redis = getClient();
  const queueKey = 'colony:location:queue';
  const batchSize = 500;
  let totalInserted = 0;

  // Determine queue length
  const queueLen = await redis.llen(queueKey);
  if (queueLen === 0) {
    logger.debug('Location queue is empty, nothing to flush', { runId });
    return;
  }

  logger.info('Flushing location queue', { runId, queueLen });

  while (true) {
    // Atomically pop up to batchSize items
    const pipeline = redis.pipeline();
    for (let i = 0; i < batchSize; i++) {
      pipeline.lpop(queueKey);
    }
    const results = await pipeline.exec();

    const entries = [];
    for (const [err, value] of results) {
      if (err || !value) continue;
      try {
        entries.push(JSON.parse(value));
      } catch (parseErr) {
        logger.warn('Failed to parse queued location entry', { error: parseErr.message });
      }
    }

    if (entries.length === 0) break;

    // Batch insert into PostgreSQL
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const values = [];
      const placeholders = [];
      let idx = 1;

      for (const entry of entries) {
        placeholders.push(
          `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, to_timestamp($${idx + 7} / 1000.0))`
        );
        values.push(
          entry.userId,
          entry.latitude,
          entry.longitude,
          entry.accuracy || null,
          entry.heading || null,
          entry.speed || null,
          entry.geohash,
          entry.timestamp
        );
        idx += 8;
      }

      await client.query(
        `INSERT INTO location_history (user_id, latitude, longitude, accuracy, heading, speed, geohash, recorded_at)
         VALUES ${placeholders.join(', ')}`,
        values
      );

      await client.query('COMMIT');
      totalInserted += entries.length;
    } catch (insertErr) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error('Failed to batch insert location entries', {
        runId,
        batchSize: entries.length,
        error: insertErr.message,
      });
      // Push entries back so they are not lost
      if (entries.length > 0) {
        const pushPipeline = redis.pipeline();
        for (const entry of entries) {
          pushPipeline.rpush(queueKey, JSON.stringify(entry));
        }
        await pushPipeline.exec();
      }
      break;
    } finally {
      client.release();
    }

    if (entries.length < batchSize) break;
  }

  logger.info('Location queue flush complete', { runId, totalInserted });
}

/**
 * Remove stale entries from the Redis geo index.
 * Users whose online key has expired (> 30 min inactive) should be removed.
 *
 * @param {number} runId
 */
async function cleanStaleGeoEntries(runId) {
  const redis = getClient();
  const geoKey = 'colony:users:geo';
  let removed = 0;

  // Get all members of the geo set
  const members = await redis.zrange(geoKey, 0, -1);
  if (members.length === 0) return;

  const pipeline = redis.pipeline();
  for (const userId of members) {
    pipeline.get(`colony:online:${userId}`);
  }
  const results = await pipeline.exec();

  const removeBatch = redis.pipeline();
  for (let i = 0; i < members.length; i++) {
    const [err, value] = results[i];
    // If the online key does not exist, the user is stale
    if (err || value !== '1') {
      removeBatch.zrem(geoKey, members[i]);
      // Also clean up cached location
      removeBatch.del(`colony:location:${members[i]}`);
      removed++;
    }
  }

  if (removed > 0) {
    await removeBatch.exec();
    logger.info('Cleaned stale geo entries', { runId, removed });
  } else {
    logger.debug('No stale geo entries to clean', { runId });
  }
}

/**
 * Stop the scheduled location sync worker.
 */
function stopLocationSyncWorker() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Location sync worker stopped');
  }
}

module.exports = { startLocationSyncWorker, stopLocationSyncWorker };
