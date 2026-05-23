'use strict';

module.exports = {
  RATE_LIMITS: {
    GENERAL: { limit: 100, windowMs: 60000 },
    OTP: { limit: 3, windowMs: 3600000 },
    AUTH: { limit: 10, windowMs: 60000 },
    LOCATION: { limit: 60, windowMs: 60000 },
  },

  OTP: {
    LENGTH: 6,
    EXPIRY_SECONDS: 300,
    RESEND_COOLDOWN: 60,
    MAX_ATTEMPTS: 5,
    LOCKOUT_MINUTES: 30,
  },

  TOKEN: {
    ACCESS_EXPIRY: '15m',
    REFRESH_EXPIRY_DAYS: 30,
    ADMIN_EXPIRY: '1h',
  },

  GEOHASH: {
    PRECISION: 6,
    CELL_PRECISION: 5,
    DEFAULT_RADIUS_KM: 5,
    MAX_RADIUS_KM: 50,
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 50,
  },

  CACHE_TTL: {
    USER_PROFILE: 3600,
    CONFIG: 86400,
    SESSION: 2592000,
    ONLINE: 30,
    RATE_LIMIT: 60,
    OTP: 600,
    LOCATION: 300,
  },

  REDIS_KEYS: {
    GEO_ACTIVE: 'colony:geo:active',
    GEO_CELL: 'colony:geo:cell:',
    USER_LOCATION: 'colony:user:location:',
    CELL_MEMBERS: 'colony:cell:members:',
    SESSION: 'colony:session:',
    ONLINE: 'colony:online:',
    CONFIG_ALL: 'colony:config:all',
    CONFIG_VERSION: 'colony:config:version',
    RATE_LIMIT: 'colony:ratelimit:',
    RATE_LIMIT_OTP: 'colony:ratelimit:otp:',
    TOKEN_BLACKLIST: 'colony:blacklist:',
  },

  REQUEST_SIGNING: {
    MAX_AGE_SECONDS: 300,
    SKIP_PATHS: ['/health', '/api/v1/config/version', '/api/v1/auth/send-otp'],
  },

  HONEYPOT_PATHS: [
    '/api/v1/admin/backdoor',
    '/api/v1/internal/debug',
    '/api/v1/config/dump',
    '/wp-admin',
    '/phpmyadmin',
    '/.env',
  ],
};
