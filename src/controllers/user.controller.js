'use strict';

const Joi = require('joi');
const response = require('../utils/response.utils');
const logger = require('../utils/logger');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const updateProfileSchema = Joi.object({
  displayName: Joi.string().trim().min(2).max(50).optional(),
  bio: Joi.string().trim().max(500).allow('', null).optional(),
  gender: Joi.string().valid('male', 'female', 'non_binary', 'prefer_not_to_say').optional(),
  interests: Joi.array().items(Joi.string().trim().max(30)).max(20).optional(),
  photos: Joi.array().items(Joi.string().uri()).max(6).optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

const updateAvatarSchema = Joi.object({
  avatarUrl: Joi.string().uri().required().messages({
    'string.uri': 'Avatar URL must be a valid URL',
    'any.required': 'Avatar URL is required',
  }),
});

const updateFCMTokenSchema = Joi.object({
  fcmToken: Joi.string().trim().min(1).max(4096).required().messages({
    'any.required': 'FCM token is required',
  }),
  platform: Joi.string().valid('android', 'ios', 'web').optional(),
});

const searchUsersSchema = Joi.object({
  q: Joi.string().trim().min(1).max(100).required().messages({
    'string.min': 'Search query must be at least 1 character',
    'any.required': 'Search query is required',
  }),
  limit: Joi.number().integer().min(1).max(50).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

const userIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.uuid': 'Invalid user ID format',
    'any.required': 'User ID is required',
  }),
});

// ---------------------------------------------------------------------------
// Sensitive fields to strip from public profiles
// ---------------------------------------------------------------------------

const PUBLIC_PROFILE_EXCLUDE = [
  'phone',
  'email',
  'notification_token',
  'fcm_tokens',
  'is_deleted',
  'deleted_at',
  'last_login_at',
  'device_ids',
  'sessions',
];

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /users/profile
 * Return the authenticated user's full profile.
 */
async function getProfile(req, res, next) {
  try {
    const user = await userService.getProfile(req.user.id);

    if (!user) {
      return response.notFound(res, 'User profile not found');
    }

    return response.success(res, { user });
  } catch (err) {
    logger.error('getProfile failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

/**
 * PUT /users/profile
 * Update display_name, bio, gender, interests, photos for the authenticated user.
 */
async function updateProfile(req, res, next) {
  try {
    const { error: validationError, value } = updateProfileSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const updatedUser = await userService.updateProfile(req.user.id, value);

    return response.success(res, { user: updatedUser }, 'Profile updated successfully');
  } catch (err) {
    logger.error('updateProfile failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

/**
 * GET /users/:id
 * Return another user's public profile with sensitive fields filtered out.
 */
async function getPublicProfile(req, res, next) {
  try {
    const { error: validationError, value } = userIdSchema.validate(req.params, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Invalid user ID', validationError.details.map((d) => d.message));
    }

    const user = await userService.getProfile(value.id);

    if (!user || user.is_deleted) {
      return response.notFound(res, 'User not found');
    }

    // Filter sensitive fields
    const publicProfile = {};
    for (const [key, val] of Object.entries(user)) {
      if (!PUBLIC_PROFILE_EXCLUDE.includes(key)) {
        publicProfile[key] = val;
      }
    }

    return response.success(res, { user: publicProfile });
  } catch (err) {
    logger.error('getPublicProfile failed', { error: err.message, targetId: req.params?.id });
    return next(err);
  }
}

/**
 * POST /users/avatar
 * Handle avatar upload. Currently a stub that accepts a URL; the actual
 * multipart upload will be handled by middleware/storage service later.
 */
async function updateAvatar(req, res, next) {
  try {
    const { error: validationError, value } = updateAvatarSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const updatedUser = await userService.updateAvatar(req.user.id, value.avatarUrl);

    return response.success(res, { user: updatedUser }, 'Avatar updated successfully');
  } catch (err) {
    logger.error('updateAvatar failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

/**
 * PUT /users/fcm-token
 * Update the user's FCM notification token for push notifications.
 */
async function updateFCMToken(req, res, next) {
  try {
    const { error: validationError, value } = updateFCMTokenSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    await userService.updateFCMToken(req.user.id, value.fcmToken, value.platform);

    return response.success(res, null, 'FCM token updated');
  } catch (err) {
    logger.error('updateFCMToken failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

/**
 * GET /users/search?q=query
 * Search users by display_name or username using pg_trgm similarity.
 */
async function searchUsers(req, res, next) {
  try {
    const { error: validationError, value } = searchUsersSchema.validate(req.query, { abortEarly: false, convert: true });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { q, limit, offset } = value;
    const results = await userService.searchUsers(q, { limit, offset, excludeUserId: req.user?.id });

    return response.success(res, {
      users: results.users,
      total: results.total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('searchUsers failed', { error: err.message, query: req.query?.q });
    return next(err);
  }
}

/**
 * DELETE /users/account
 * Soft-delete the authenticated user's account and invalidate all sessions.
 */
async function deleteAccount(req, res, next) {
  try {
    await userService.softDeleteAccount(req.user.id);
    await authService.invalidateAllSessions(req.user.id);

    return response.success(res, null, 'Account deleted successfully');
  } catch (err) {
    logger.error('deleteAccount failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getPublicProfile,
  updateAvatar,
  updateFCMToken,
  searchUsers,
  deleteAccount,
};
