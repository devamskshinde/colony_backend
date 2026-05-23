'use strict';

const logger = require('../utils/logger');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// ---------- Custom Error Classes ----------

class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.errors = errors || [];
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message || 'Unauthorized');
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
    this.code = 'UNAUTHORIZED';
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message || 'Forbidden');
    this.name = 'ForbiddenError';
    this.statusCode = 403;
    this.code = 'FORBIDDEN';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message || 'Resource not found');
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message || 'Too many requests');
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.retryAfter = retryAfter;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message || 'Resource conflict');
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = 'CONFLICT';
  }
}

// ---------- Error mapping ----------

/**
 * Map an error to a structured response object.
 */
function resolveError(err) {
  // Custom application errors
  if (err.statusCode && err.code) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      errors: err.errors || undefined,
    };
  }

  // JWT errors
  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Token has expired',
    };
  }
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid token',
    };
  }

  // Express body-parser errors
  if (err.type === 'entity.parse.failed') {
    return {
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'Malformed JSON in request body',
    };
  }
  if (err.type === 'entity.too.large') {
    return {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    };
  }

  // PostgreSQL errors (pg driver)
  if (err.code && typeof err.code === 'string' && err.code.length === 5) {
    // Unique violation
    if (err.code === '23505') {
      return {
        statusCode: 409,
        code: 'DUPLICATE_ENTRY',
        message: 'A record with the given value already exists',
      };
    }
    // Foreign key violation
    if (err.code === '23503') {
      return {
        statusCode: 400,
        code: 'REFERENCE_ERROR',
        message: 'Referenced record does not exist',
      };
    }
    // Not null violation
    if (err.code === '23502') {
      return {
        statusCode: 400,
        code: 'MISSING_FIELD',
        message: `Required field is missing: ${err.column || 'unknown'}`,
      };
    }
    // Check violation
    if (err.code === '23514') {
      return {
        statusCode: 400,
        code: 'CHECK_VIOLATION',
        message: 'Value violates a database constraint',
      };
    }
  }

  // Multer file-upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return {
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
      message: 'Uploaded file is too large',
    };
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return {
      statusCode: 400,
      code: 'UNEXPECTED_FILE',
      message: 'Unexpected file field',
    };
  }

  // Fallback — internal server error
  return {
    statusCode: err.statusCode || 500,
    code: 'INTERNAL_ERROR',
    message: IS_PROD ? 'An unexpected error occurred' : (err.message || 'Internal server error'),
  };
}

/**
 * Global error handler middleware.
 * Must have exactly 4 parameters for Express to recognize it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const resolved = resolveError(err);
  const statusCode = resolved.statusCode;

  // Build the log entry
  const logMeta = {
    errorName: err.name,
    errorCode: err.code,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    requestId: req.requestId,
    userId: req.user?.id,
    ip: req.ip,
  };

  if (IS_PROD) {
    // In production: log sanitized info only
    logger.error(`Error: ${resolved.message}`, logMeta);
  } else {
    // In development: log the full error including stack
    logger.error(`Error: ${resolved.message}`, {
      ...logMeta,
      stack: err.stack,
      originalMessage: err.message,
    });
  }

  // Build the response
  const responseBody = {
    success: false,
    message: resolved.message,
    code: resolved.code,
    requestId: req.requestId || undefined,
  };

  if (resolved.errors && resolved.errors.length > 0) {
    responseBody.errors = resolved.errors;
  }

  // Add Retry-After header for rate limit errors
  if (resolved.code === 'RATE_LIMIT_EXCEEDED' && err.retryAfter) {
    res.setHeader('Retry-After', err.retryAfter);
  }

  // Never leak stack traces in production
  if (!IS_PROD && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
}

/**
 * Catch-all for requests that reach no route (404).
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
    requestId: req.requestId || undefined,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ConflictError,
};
