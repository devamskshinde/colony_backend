'use strict';

const Joi = require('joi');
const response = require('../utils/response.utils');
const logger = require('../utils/logger');
const locationService = require('../services/location.service');

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Latitude must be between -90 and 90',
    'number.max': 'Latitude must be between -90 and 90',
    'any.required': 'Latitude is required',
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Longitude must be between -180 and 180',
    'number.max': 'Longitude must be between -180 and 180',
    'any.required': 'Longitude is required',
  }),
  accuracy: Joi.number().positive().max(5000).optional(),
  altitude: Joi.number().optional(),
});

const getNearbySchema = Joi.object({
  radius: Joi.number().positive().max(50).default(5).messages({
    'number.max': 'Radius cannot exceed 50 km',
  }),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /location/update
 * Update the authenticated user's location. Returns the count of nearby users.
 */
async function updateLocation(req, res, next) {
  try {
    const { error: validationError, value } = updateLocationSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { latitude, longitude, accuracy, altitude } = value;

    const result = await locationService.updateLocation({
      userId: req.user.id,
      latitude,
      longitude,
      accuracy,
      altitude,
    });

    return response.success(res, {
      nearbyUsersCount: result.nearbyUsersCount,
      location: {
        latitude,
        longitude,
        updatedAt: new Date().toISOString(),
      },
    }, 'Location updated');
  } catch (err) {
    logger.error('updateLocation failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

/**
 * GET /location/nearby?radius=&limit=
 * Return a list of nearby users with their distances.
 */
async function getNearby(req, res, next) {
  try {
    const { error: validationError, value } = getNearbySchema.validate(req.query, { abortEarly: false, convert: true });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { radius, limit, offset } = value;

    const nearbyUsers = await locationService.getNearbyUsers({
      userId: req.user.id,
      radiusKm: radius,
      limit,
      offset,
    });

    return response.success(res, {
      users: nearbyUsers,
      radius,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('getNearby failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

/**
 * GET /location
 * Return the authenticated user's current cached location.
 */
async function getLocation(req, res, next) {
  try {
    const location = await locationService.getUserLocation(req.user.id);

    if (!location) {
      return response.notFound(res, 'No location data found. Please update your location first.');
    }

    return response.success(res, { location });
  } catch (err) {
    logger.error('getLocation failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

/**
 * DELETE /location
 * Remove the authenticated user from geo tracking (clears cached location).
 */
async function removeLocation(req, res, next) {
  try {
    await locationService.removeLocation(req.user.id);

    return response.success(res, null, 'Location data removed');
  } catch (err) {
    logger.error('removeLocation failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

module.exports = {
  updateLocation,
  getNearby,
  getLocation,
  removeLocation,
};
