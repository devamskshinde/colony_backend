'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const response = require('../utils/response.utils');
const env = require('../config/environment');

const log = logger.child({ controller: 'adminAuth' });

/**
 * POST /api/v1/admin/auth/login
 * Admin login with username + password. Returns JWT.
 */
async function login(req, res, next) {
  try {
    const { username, password, totp } = req.body;

    if (!username || !password) {
      return response.badRequest(res, 'Username and password required');
    }

    // Find admin user
    const result = await query(
      'SELECT id, username, password_hash, email, role, permissions, two_factor_enabled, two_factor_secret, is_active FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      log.warn('Admin login failed: user not found', { username });
      return response.unauthorized(res, 'Invalid credentials');
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      log.warn('Admin login failed: account disabled', { username });
      return response.unauthorized(res, 'Account is disabled');
    }

    // Verify password
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      log.warn('Admin login failed: wrong password', { username });
      return response.unauthorized(res, 'Invalid credentials');
    }

    // Check 2FA if enabled
    if (admin.two_factor_enabled) {
      if (!totp) {
        return response.success(res, { requires2FA: true }, '2FA code required');
      }
      // In production: verify TOTP code against admin.two_factor_secret
      // For now, accept any 6-digit code in dev
      if (!/^\d{6}$/.test(totp)) {
        return response.badRequest(res, 'Invalid 2FA code');
      }
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        permissions: admin.permissions,
        type: 'admin',
      },
      env.JWT_ADMIN_SECRET,
      { expiresIn: '8h' }
    );

    // Update last login
    await query(
      'UPDATE admin_users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [req.ip, admin.id]
    );

    log.info('Admin login successful', { username, role: admin.role });

    return response.success(res, {
      token,
      admin: {
        id: admin.id.toString(),
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: new Date().toISOString(),
      },
    });
  } catch (err) {
    log.error('Admin login error', { error: err.message });
    return next(err);
  }
}

/**
 * GET /api/v1/admin/auth/me
 * Get current admin user info from JWT.
 */
async function me(req, res, next) {
  try {
    const result = await query(
      'SELECT id, username, email, role, permissions, last_login_at FROM admin_users WHERE id = $1',
      [req.admin.id]
    );

    if (result.rows.length === 0) {
      return response.unauthorized(res, 'Admin user not found');
    }

    const admin = result.rows[0];
    return response.success(res, {
      id: admin.id.toString(),
      username: admin.username,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      lastLogin: admin.last_login_at,
    });
  } catch (err) {
    log.error('Admin me error', { error: err.message });
    return next(err);
  }
}

module.exports = { login, me };
