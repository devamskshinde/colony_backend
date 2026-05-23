'use strict';

const cron = require('node-cron');
const { pool, query } = require('../config/database');
const { getClient } = require('../config/redis');
const logger = require('../utils/logger');

let scheduledTask = null;

/**
 * Start the cleanup worker.
 * Runs every hour to:
 *   1. Delete expired OTPs (older than 10 minutes)
 *   2. Delete expired sessions
 *   3. Clean up blacklisted tokens that have already expired
 *   4. Archive location_history older than 90 days
 *   5. Clean up stale online indicators in Redis
 */
function startCleanupWorker() {
  if (scheduledTask) {
    logger.warn('Cleanup worker is already running');
    return;
  }

  scheduledTask = cron.schedule('0 * * * *', async () => {
    const runId = Date.now();
    logger.info('Cleanup worker started', { runId });

    const results = {};

    try {
      results.otps = await cleanExpiredOTPs();
      results.sessions = await cleanExpiredSessions();
      results.blacklistedTokens = await cleanBlacklistedTokens();
      results.archivedLocations = await archiveOldLocationHistory();
      results.staleOnlineIndicators = await cleanStaleOnlineIndicators();

      logger.info('Cleanup worker completed', { runId, results });
    } catch (err) {
      logger.error('Cleanup worker failed', { runId, error: err.message, stack: err.stack, results });
    }
  });

  logger.info('Cleanup worker scheduled (every hour)');
}

/**
 * Delete OTPs older than 10 minutes.
 * @returns {Promise<number>} Rows deleted
 */
async function cleanExpiredOTPs() {
  try {
    const result = await query(
      "DELETE FROM otps WHERE created_at < NOW() - INTERVAL '10 minutes'"
    );
    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info('Cleaned expired OTPs', { count });
    }
    return count;
  } catch (err) {
    // Table may not exist yet
    logger.warn('Failed to clean expired OTPs (table may not exist)', { error: err.message });
    return 0;
  }
}

/**
 * Delete expired sessions.
 * @returns {Promise<number>} Rows deleted
 */
async function cleanExpiredSessions() {
  try {
    const result = await query(
      "DELETE FROM sessions WHERE expires_at < NOW()"
    );
    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info('Cleaned expired sessions', { count });
    }
    return count;
  } catch (err) {
    logger.warn('Failed to clean expired sessions (table may not exist)', { error: err.message });
    return 0;
  }
}

/**
 * Delete blacklisted tokens whose expiry has passed (they can never be used again).
 * @returns {Promise<number>} Rows deleted
 */
async function cleanBlacklistedTokens() {
  try {
    const result = await query(
      "DELETE FROM token_blacklist WHERE expires_at < NOW()"
    );
    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info('Cleaned blacklisted tokens', { count });
    }
    return count;
  } catch (err) {
    logger.warn('Failed to clean blacklisted tokens (table may not exist)', { error: err.message });
    return 0;
  }
}

/**
 * Archive location_history rows older than 90 days.
 * Moves them to location_history_archive, then deletes from the source.
 * If the archive table does not exist, creates it first.
 * @returns {Promise<number>} Rows archived
 */
async function archiveOldLocationHistory() {
  const client = await pool.connect();
  try {
    // Ensure archive table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS location_history_archive (
        LIKE location_history INCLUDING ALL
      )
    `);

    await client.query('BEGIN');

    // Copy old rows to archive
    const insertResult = await client.query(
      `INSERT INTO location_history_archive
       SELECT * FROM location_history
       WHERE recorded_at < NOW() - INTERVAL '90 days'`
    );

    const count = insertResult.rowCount || 0;

    if (count > 0) {
      // Delete archived rows from source
      await client.query(
        "DELETE FROM location_history WHERE recorded_at < NOW() - INTERVAL '90 days'"
      );
      logger.info('Archived old location history', { count });
    }

    await client.query('COMMIT');
    return count;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.warn('Failed to archive location history', { error: err.message });
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Remove stale online indicators from Redis.
 * Scans for colony:online:* keys and removes any that have somehow
 * persisted beyond their TTL (defensive cleanup).
 * Also removes orphaned cell member entries.
 * @returns {Promise<number>} Keys removed
 */
async function cleanStaleOnlineIndicators() {
  const redis = getClient();
  let removed = 0;

  // Clean up any orphaned cell member sets
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      'colony:cell:members:*',
      'COUNT',
      100
    );
    cursor = nextCursor;

    for (const key of keys) {
      const members = await redis.smembers(key);
      if (members.length === 0) {
        await redis.del(key);
        removed++;
        continue;
      }

      // Check if any member is still online; if none are, clean the set
      const pipeline = redis.pipeline();
      for (const userId of members) {
        pipeline.get(`colony:online:${userId}`);
      }
      const results = await pipeline.exec();

      const staleMembers = [];
      for (let i = 0; i < members.length; i++) {
        const [err, value] = results[i];
        if (err || value !== '1') {
          staleMembers.push(members[i]);
        }
      }

      if (staleMembers.length > 0) {
        const remPipeline = redis.pipeline();
        for (const userId of staleMembers) {
          remPipeline.srem(key, userId);
        }
        await remPipeline.exec();
      }

      // If the set is now empty, delete it
      const remaining = await redis.scard(key);
      if (remaining === 0) {
        await redis.del(key);
        removed++;
      }
    }
  } while (cursor !== '0');

  // Clean up orphaned location cache keys
  cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      'colony:location:*',
      'COUNT',
      100
    );
    cursor = nextCursor;

    for (const key of keys) {
      // Check TTL; if key has no TTL somehow, set one
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // Key exists but has no expiry -- set a 5-minute TTL as safety net
        await redis.expire(key, 300);
        removed++;
      }
    }
  } while (cursor !== '0');

  if (removed > 0) {
    logger.info('Cleaned stale online/Redis indicators', { removed });
  }

  return removed;
}

/**
 * Stop the scheduled cleanup worker.
 */
function stopCleanupWorker() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Cleanup worker stopped');
  }
}

module.exports = { startCleanupWorker, stopCleanupWorker };
