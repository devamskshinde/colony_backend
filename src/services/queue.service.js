'use strict';

const logger = require('../utils/logger');

const log = logger.child({ service: 'queue' });

const QUEUES = {
  LOCATION_HISTORY: 'location_history',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
  CLEANUP: 'cleanup',
};

const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // ms between reconnection attempts
const MAX_RETRIES = RETRY_DELAYS.length;

let connection = null;
let channel = null;
let amqpLib = null;
let connectionUrl = null;
let isConnecting = false;
let reconnectAttempt = 0;
let consumers = new Map(); // queue -> handler, for re-registration after reconnect

// In-memory fallback for dev mode when RabbitMQ is unavailable
let useInMemory = false;
const inMemoryQueues = {};

/**
 * Initialize the queue service.
 * @param {object} opts
 * @param {string} opts.url - RabbitMQ connection URL (amqp://...)
 * @param {object} [opts.amqpLib] - amqplib module (for dependency injection / testing)
 */
function init(opts = {}) {
  connectionUrl = opts.url || process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  amqpLib = opts.amqpLib || null;
}

/**
 * Load amqplib dynamically. Returns null if unavailable (dev fallback).
 */
async function loadAmqplib() {
  if (amqpLib) return amqpLib;
  try {
    amqpLib = require('amqplib');
    return amqpLib;
  } catch (err) {
    log.warn('amqplib not installed, falling back to in-memory queue');
    return null;
  }
}

/**
 * Connect to RabbitMQ with retry logic.
 * In dev mode, if RabbitMQ is unreachable, falls back to in-memory queues.
 */
async function connect() {
  const lib = await loadAmqplib();
  if (!lib) {
    enableInMemoryFallback();
    return;
  }

  if (isConnecting) return;
  isConnecting = true;

  while (reconnectAttempt < MAX_RETRIES) {
    try {
      log.info('Connecting to RabbitMQ', { attempt: reconnectAttempt + 1, url: connectionUrl });
      connection = await lib.connect(connectionUrl);

      connection.on('error', (err) => {
        log.error('RabbitMQ connection error', { error: err.message });
      });

      connection.on('close', () => {
        log.warn('RabbitMQ connection closed, scheduling reconnect');
        channel = null;
        connection = null;
        scheduleReconnect();
      });

      channel = await connection.createConfirmChannel();
      await channel.prefetch(10);

      channel.on('error', (err) => {
        log.error('RabbitMQ channel error', { error: err.message });
      });

      channel.on('close', () => {
        log.warn('RabbitMQ channel closed');
        channel = null;
      });

      // Assert all standard queues
      for (const queueName of Object.values(QUEUES)) {
        await channel.assertQueue(queueName, { durable: true });
      }

      // Re-register consumers after reconnect
      for (const [queueName, handler] of consumers.entries()) {
        await registerConsumer(queueName, handler);
      }

      reconnectAttempt = 0;
      isConnecting = false;
      log.info('RabbitMQ connected successfully');
      return;
    } catch (err) {
      reconnectAttempt++;
      const delay = RETRY_DELAYS[Math.min(reconnectAttempt - 1, RETRY_DELAYS.length - 1)];
      log.error('RabbitMQ connection failed', {
        error: err.message,
        attempt: reconnectAttempt,
        nextRetryMs: delay,
      });

      if (reconnectAttempt >= MAX_RETRIES && process.env.NODE_ENV !== 'production') {
        log.warn('Max retries reached in dev mode, switching to in-memory fallback');
        enableInMemoryFallback();
        isConnecting = false;
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  isConnecting = false;
  log.error('Failed to connect to RabbitMQ after max retries');
}

function scheduleReconnect() {
  if (isConnecting) return;
  const delay = RETRY_DELAYS[Math.min(reconnectAttempt, RETRY_DELAYS.length - 1)];
  log.info('Scheduling RabbitMQ reconnect', { delayMs: delay });
  setTimeout(() => connect(), delay);
}

function enableInMemoryFallback() {
  useInMemory = true;
  for (const queueName of Object.values(QUEUES)) {
    if (!inMemoryQueues[queueName]) {
      inMemoryQueues[queueName] = [];
    }
  }
  log.info('In-memory queue fallback enabled');
}

/**
 * Internal: register a consumer on a channel.
 */
async function registerConsumer(queueName, handler) {
  if (!channel) return;
  await channel.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content, msg.properties);
      channel.ack(msg);
    } catch (err) {
      log.error('Consumer handler error', { queue: queueName, error: err.message });
      // Requeue on failure (with a limit in production via x-death header)
      channel.nack(msg, false, false);
    }
  });
}

/**
 * Publish a message to a queue.
 * @param {string} queue - Queue name
 * @param {object} message - Message payload (will be JSON-serialized)
 * @param {object} [opts] - Additional publish options
 */
async function publish(queue, message, opts = {}) {
  if (useInMemory) {
    if (!inMemoryQueues[queue]) inMemoryQueues[queue] = [];
    inMemoryQueues[queue].push(message);
    log.debug('Message queued in-memory', { queue, queueSize: inMemoryQueues[queue].length });

    // Trigger in-memory consumers
    const handler = consumers.get(queue);
    if (handler) {
      try {
        await handler(message, {});
      } catch (err) {
        log.error('In-memory consumer error', { queue, error: err.message });
      }
    }
    return;
  }

  if (!channel) {
    log.error('Cannot publish, no channel available', { queue });
    throw new Error('Queue service not connected');
  }

  try {
    const payload = Buffer.from(JSON.stringify(message));
    channel.sendToQueue(queue, payload, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
      ...opts,
    });
    log.debug('Message published', { queue });
  } catch (err) {
    log.error('Failed to publish message', { queue, error: err.message });
    throw err;
  }
}

/**
 * Register a consumer for a queue.
 * @param {string} queue - Queue name
 * @param {function} handler - async (message, properties) => void
 */
async function consume(queue, handler) {
  consumers.set(queue, handler);

  if (useInMemory) {
    log.debug('Consumer registered (in-memory)', { queue });
    return;
  }

  if (!channel) {
    log.debug('Consumer registered (will activate on connect)', { queue });
    return;
  }

  await registerConsumer(queue, handler);
  log.info('Consumer registered', { queue });
}

/**
 * Gracefully close the connection.
 */
async function close() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    log.info('Queue service closed');
  } catch (err) {
    log.error('Error closing queue service', { error: err.message });
  }
}

/**
 * Check if connected (or using fallback).
 */
function isConnected() {
  return useInMemory || (connection !== null && channel !== null);
}

module.exports = {
  QUEUES,
  init,
  connect,
  publish,
  consume,
  close,
  isConnected,
};
