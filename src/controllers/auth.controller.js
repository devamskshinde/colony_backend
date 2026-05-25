'use strict';

const Joi = require('joi');
const response = require('../utils/response.utils');
const logger = require('../utils/logger');
const otpService = require('../services/otp.service');
const authService = require('../services/auth.service');

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const sendOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone must be a valid Indian 10-digit number starting with 6-9',
      'any.required': 'Phone number is required',
    }),
  deviceId: Joi.string().trim().min(1).max(128).optional(),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone must be a valid Indian 10-digit number starting with 6-9',
      'any.required': 'Phone number is required',
    }),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'OTP must be a 6-digit number',
      'any.required': 'OTP is required',
    }),
  deviceId: Joi.string().trim().min(1).max(128).optional(),
});

const registerSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone must be a valid Indian 10-digit number starting with 6-9',
      'any.required': 'Phone number is required',
    }),
  displayName: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Display name must be at least 2 characters',
    'string.max': 'Display name cannot exceed 50 characters',
    'any.required': 'Display name is required',
  }),
  username: Joi.string()
    .trim()
    .min(3)
    .max(30)
    .pattern(/^[a-z0-9_.]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Username can only contain lowercase letters, numbers, underscores, and dots',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required',
    }),
  dateOfBirth: Joi.date().iso().max('now').required().messages({
    'date.base': 'Date of birth must be a valid ISO date',
    'date.max': 'Date of birth cannot be in the future',
    'any.required': 'Date of birth is required',
  }),
  deviceId: Joi.string().trim().min(1).max(128).optional(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().min(1).required().messages({
    'any.required': 'Refresh token is required',
  }),
  deviceId: Joi.string().trim().min(1).max(128).required().messages({
    'any.required': 'Device ID is required',
  }),
});

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /auth/send-otp
 * Validate phone, check rate limit, generate OTP, return cooldown.
 */
async function sendOtp(req, res, next) {
  try {
    const { error: validationError, value } = sendOtpSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { phone, deviceId } = value;

    const result = await otpService.generateOtp({ phone, deviceId });

    return response.success(res, {
      cooldownSeconds: result.cooldownSeconds,
    }, result.message);
  } catch (err) {
    logger.error('sendOtp failed', { error: err.message, phone: req.body?.phone });
    if (err.statusCode === 429) {
      return response.tooMany(res, err.message);
    }
    return next(err);
  }
}

/**
 * POST /auth/verify-otp
 * Validate phone + OTP. If new user, signal registration needed. Otherwise login.
 */
async function verifyOtp(req, res, next) {
  try {
    const { error: validationError, value } = verifyOtpSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { phone, otp, deviceId } = value;

    const verification = await otpService.verifyOtp({ phone, otp });

    if (!verification.valid) {
      return response.unauthorized(res, 'Invalid or expired OTP');
    }

    // Check if user already exists
    const existingUser = await authService.findUserByPhone(phone);

    if (!existingUser) {
      // New user -- must register
      return response.success(res, {
        isNewUser: true,
        phone,
      }, 'OTP verified. Please complete registration.');
    }

    // Existing user -- issue tokens
    const tokens = await authService.login({ userId: existingUser.id, deviceId });

    return response.success(res, {
      isNewUser: false,
      user: {
        id: existingUser.id,
        displayName: existingUser.display_name,
        username: existingUser.username,
        avatarUrl: existingUser.avatar_url,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }, 'Login successful');
  } catch (err) {
    logger.error('verifyOtp failed', { error: err.message, phone: req.body?.phone });
    return next(err);
  }
}

/**
 * POST /auth/register
 * Complete registration for a new user after OTP verification.
 */
async function register(req, res, next) {
  try {
    const { error: validationError, value } = registerSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { phone, displayName, username, dateOfBirth, deviceId } = value;

    const result = await authService.register({
      phone,
      displayName,
      username,
      dateOfBirth,
      deviceId,
    });

    return response.created(res, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }, 'Registration successful');
  } catch (err) {
    logger.error('register failed', { error: err.message, phone: req.body?.phone });
    if (err.statusCode === 409) {
      return response.conflict(res, err.message);
    }
    return next(err);
  }
}

/**
 * POST /auth/refresh
 * Exchange a refresh token + deviceId for a new token pair.
 */
async function refreshToken(req, res, next) {
  try {
    const { error: validationError, value } = refreshTokenSchema.validate(req.body, { abortEarly: false });
    if (validationError) {
      return response.badRequest(res, 'Validation failed', validationError.details.map((d) => d.message));
    }

    const { refreshToken: token, deviceId } = value;

    const tokens = await authService.refreshToken({ refreshToken: token, deviceId });

    return response.success(res, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }, 'Token refreshed');
  } catch (err) {
    logger.error('refreshToken failed', { error: err.message });
    if (err.statusCode === 401) {
      return response.unauthorized(res, err.message);
    }
    return next(err);
  }
}

/**
 * POST /auth/logout
 * Invalidate the current session / all sessions for the user.
 */
async function logout(req, res, next) {
  try {
    const userId = req.user.id;
    await authService.logout({ userId, sessionId: req.sessionId });

    return response.success(res, null, 'Logged out successfully');
  } catch (err) {
    logger.error('logout failed', { error: err.message, userId: req.user?.id });
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Email/Password Auth
// ---------------------------------------------------------------------------

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const env = require('../config/environment');

const registerEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  displayName: Joi.string().trim().min(2).max(50).required(),
});

const loginEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

/**
 * POST /auth/register-email
 * Register a new user with email + password.
 */
async function registerEmail(req, res, next) {
  try {
    const { error, value } = registerEmailSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return response.badRequest(res, 'Validation failed', error.details.map((d) => d.message));
    }

    const { email, password, displayName } = value;

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return response.conflict(res, 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate a placeholder phone (email users don't have phones initially)
    const placeholderPhone = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create user
    const result = await query(
      `INSERT INTO users (phone, phone_verified, email, email_verified, display_name, username, password_hash)
       VALUES ($1, false, $2, false, $3, $4, $5)
       RETURNING id, display_name, username, email`,
      [placeholderPhone, email, displayName, email.split('@')[0].replace(/[^a-z0-9_.]/g, '_'), passwordHash]
    );

    const user = result.rows[0];

    // Generate tokens
    const jti = require('crypto').randomUUID();
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, type: 'user' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { id: user.id, jti, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRY }
    );

    logger.info('Email registration successful', { userId: user.id, email });

    return response.created(res, {
      user: { id: user.id, displayName: user.display_name, username: user.username, email: user.email },
      accessToken,
      refreshToken,
    }, 'Registration successful');
  } catch (err) {
    logger.error('registerEmail failed', { error: err.message });
    return next(err);
  }
}

/**
 * POST /auth/login-email
 * Login with email + password.
 */
async function loginEmail(req, res, next) {
  try {
    const { error, value } = loginEmailSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return response.badRequest(res, 'Validation failed', error.details.map((d) => d.message));
    }

    const { email, password } = value;

    // Find user by email
    const result = await query(
      'SELECT id, display_name, username, email, password_hash, is_active, is_deleted FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return response.unauthorized(res, 'Invalid email or password');
    }

    const user = result.rows[0];

    if (user.is_deleted) {
      return response.unauthorized(res, 'Account has been deleted');
    }

    if (!user.is_active) {
      return response.unauthorized(res, 'Account is disabled');
    }

    if (!user.password_hash) {
      return response.unauthorized(res, 'This account uses phone login. Please use OTP.');
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return response.unauthorized(res, 'Invalid email or password');
    }

    // Generate tokens
    const jti = require('crypto').randomUUID();
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, type: 'user' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { id: user.id, jti, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRY }
    );

    // Update last active
    await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    logger.info('Email login successful', { userId: user.id, email });

    return response.success(res, {
      user: { id: user.id, displayName: user.display_name, username: user.username, email: user.email },
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (err) {
    logger.error('loginEmail failed', { error: err.message });
    return next(err);
  }
}

module.exports = {
  sendOtp,
  verifyOtp,
  register,
  refreshToken,
  logout,
  registerEmail,
  loginEmail,
};
