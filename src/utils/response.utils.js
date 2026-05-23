'use strict';

/**
 * Standardized API response utilities.
 * All controllers use these helpers to ensure consistent JSON shape.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {*} data - Payload
 * @param {string} [message='Success']
 * @param {number} [statusCode=200]
 */
function success(res, data = null, message = 'Success', statusCode = 200) {
  const body = {
    success: true,
    message,
  };
  if (data !== null && data !== undefined) {
    body.data = data;
  }
  return res.status(statusCode).json(body);
}

/**
 * Send a created (201) response.
 */
function created(res, data = null, message = 'Created successfully') {
  return success(res, data, message, 201);
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode=500]
 * @param {*} [errors] - Detailed error info (e.g. validation array)
 */
function error(res, message = 'Internal server error', statusCode = 500, errors = null) {
  const body = {
    success: false,
    message,
  };
  if (errors !== null && errors !== undefined) {
    body.errors = errors;
  }
  return res.status(statusCode).json(body);
}

/**
 * Send a 400 Bad Request.
 */
function badRequest(res, message = 'Bad request', errors = null) {
  return error(res, message, 400, errors);
}

/**
 * Send a 401 Unauthorized.
 */
function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401);
}

/**
 * Send a 403 Forbidden.
 */
function forbidden(res, message = 'Forbidden') {
  return error(res, message, 403);
}

/**
 * Send a 404 Not Found.
 */
function notFound(res, message = 'Resource not found') {
  return error(res, message, 404);
}

/**
 * Send a 409 Conflict.
 */
function conflict(res, message = 'Conflict') {
  return error(res, message, 409);
}

/**
 * Send a 429 Too Many Requests.
 */
function tooMany(res, message = 'Too many requests, please try again later') {
  return error(res, message, 429);
}

module.exports = {
  success,
  created,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooMany,
};
