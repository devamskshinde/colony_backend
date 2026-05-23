'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET;

if (!JWT_ADMIN_SECRET) {
  logger.warn('JWT_ADMIN_SECRET is not set. Admin auth middleware will fail at runtime.');
}

const ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

/**
 * Extract the Bearer token from the Authorization header.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1] || null;
}

/**
 * Get the client's real IP address, respecting common proxy headers.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '';
}

/**
 * Core admin token verification.
 * Returns decoded admin payload or throws an error.
 */
function verifyAdminToken(req) {
  const token = extractToken(req);
  if (!token) {
    const err = new Error('Admin authentication required');
    err.code = 'NO_TOKEN';
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_ADMIN_SECRET, { algorithms: ['HS256'] });
  } catch (jwtErr) {
    if (jwtErr.name === 'TokenExpiredError') {
      const err = new Error('Admin token has expired');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }
    const err = new Error('Invalid admin token');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  // Verify the token is explicitly an admin token
  if (decoded.type !== 'admin') {
    const err = new Error('Token is not an admin token');
    err.code = 'INVALID_TOKEN_TYPE';
    throw err;
  }

  // IP allowlist check (if configured)
  if (ALLOWED_IPS.length > 0) {
    const clientIp = getClientIp(req);
    if (!ALLOWED_IPS.includes(clientIp)) {
      logger.warn('Admin access denied: IP not in allowlist', {
        clientIp,
        adminId: decoded.id,
      });
      const err = new Error('Access denied from this IP address');
      err.code = 'IP_NOT_ALLOWED';
      throw err;
    }
  }

  return {
    id: decoded.id || decoded.sub,
    username: decoded.username,
    role: decoded.role,
    permissions: decoded.permissions || [],
  };
}

/**
 * Required admin authentication middleware.
 * Rejects with 401 if the token is missing, invalid, or expired.
 * Rejects with 403 if the IP is not allowed.
 */
async function adminAuthenticate(req, res, next) {
  try {
    req.admin = verifyAdminToken(req);
    next();
  } catch (err) {
    const statusCode = err.code === 'IP_NOT_ALLOWED' ? 403 : 401;

    logger.warn('Admin authentication failed', {
      code: err.code,
      path: req.originalUrl,
      method: req.method,
      ip: getClientIp(req),
    });

    return res.status(statusCode).json({
      success: false,
      message: err.message,
      code: err.code || 'UNAUTHORIZED',
      requestId: req.requestId || undefined,
    });
  }
}

/**
 * Authorization middleware factory: requires the admin to have one of the specified roles.
 *
 * Usage: requireRole('superadmin', 'moderator')
 *
 * Must be placed AFTER adminAuthenticate.
 */
function requireRole(...roles) {
  return function roleCheck(req, res, next) {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required',
        code: 'UNAUTHORIZED',
        requestId: req.requestId || undefined,
      });
    }

    if (!roles.includes(req.admin.role)) {
      logger.warn('Admin role authorization failed', {
        adminId: req.admin.id,
        requiredRoles: roles,
        actualRole: req.admin.role,
        path: req.originalUrl,
      });

      return res.status(403).json({
        success: false,
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
        requestId: req.requestId || undefined,
      });
    }

    next();
  };
}

/**
 * Authorization middleware factory: requires the admin to have a specific permission.
 *
 * Usage: requirePermission('users:delete')
 *
 * Must be placed AFTER adminAuthenticate.
 */
function requirePermission(permission) {
  return function permissionCheck(req, res, next) {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required',
        code: 'UNAUTHORIZED',
        requestId: req.requestId || undefined,
      });
    }

    const permissions = req.admin.permissions || [];

    // Superadmins with wildcard permission bypass checks
    if (permissions.includes('*') || permissions.includes(permission)) {
      return next();
    }

    logger.warn('Admin permission authorization failed', {
      adminId: req.admin.id,
      requiredPermission: permission,
      actualPermissions: permissions,
      path: req.originalUrl,
    });

    return res.status(403).json({
      success: false,
      message: `This action requires the "${permission}" permission`,
      code: 'INSUFFICIENT_PERMISSION',
      requestId: req.requestId || undefined,
    });
  };
}

module.exports = {
  adminAuthenticate,
  requireRole,
  requirePermission,
};
