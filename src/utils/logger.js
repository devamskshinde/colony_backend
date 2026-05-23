'use strict';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug);

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'otp',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
];

/**
 * Redact sensitive fields from an object (shallow + one level deep).
 */
function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const redacted = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function formatMessage(level, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (meta && Object.keys(meta).length > 0) {
    Object.assign(entry, meta);
  }
  return JSON.stringify(entry);
}

function write(level, message, meta) {
  if (LOG_LEVELS[level] > currentLevel) return;

  const formatted = formatMessage(level, message, meta);
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(formatted + '\n');
}

const logger = {
  error(message, meta) {
    write('error', message, meta);
  },

  warn(message, meta) {
    write('warn', message, meta);
  },

  info(message, meta) {
    write('info', message, meta);
  },

  http(message, meta) {
    write('http', message, meta);
  },

  debug(message, meta) {
    write('debug', message, meta);
  },

  /**
   * Create a child logger with preset metadata that is merged into every call.
   */
  child(defaultMeta) {
    return {
      error(message, meta) { write('error', message, { ...defaultMeta, ...meta }); },
      warn(message, meta)  { write('warn', message, { ...defaultMeta, ...meta }); },
      info(message, meta)  { write('info', message, { ...defaultMeta, ...meta }); },
      http(message, meta)  { write('http', message, { ...defaultMeta, ...meta }); },
      debug(message, meta) { write('debug', message, { ...defaultMeta, ...meta }); },
      child(extraMeta) { return logger.child({ ...defaultMeta, ...extraMeta }); },
    };
  },

  redactSensitive,
};

module.exports = logger;
