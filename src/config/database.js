'use strict';

const { Pool } = require('pg');
const env = require('./environment');
const logger = require('../utils/logger');

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});

pool.on('connect', () => {
  logger.info('New PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

/**
 * Execute a parameterized query against the pool.
 * @param {string} text - SQL query text
 * @param {any[]} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn('Slow query detected', { duration, text: text.substring(0, 200) });
    }
    return result;
  } catch (err) {
    logger.error('Query error', { error: err.message, text: text.substring(0, 200) });
    throw err;
  }
}

/**
 * Get a dedicated client from the pool for transactions.
 * Caller MUST call client.release() when done.
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  return pool.connect();
}

module.exports = { pool, query, getClient };
