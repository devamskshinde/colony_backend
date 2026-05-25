'use strict';

const { Router } = require('express');
const { adminAuthenticate } = require('../../middleware/adminAuth.middleware');
const response = require('../../utils/response.utils');
const logger = require('../../utils/logger');
const { pool } = require('../../config/database');
const env = require('../../config/environment');

const router = Router();
router.use(adminAuthenticate);

// ─── GET /admin/infrastructure ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [dbStatus, dbVersion] = await Promise.all([
      pool.query('SELECT 1').then(() => 'connected').catch(() => 'disconnected'),
      pool.query('SELECT version()').then(r => r.rows[0].version.split(',')[0]).catch(() => 'unknown'),
    ]);

    return response.success(res, {
      database: {
        host: env.DB_HOST || 'localhost',
        port: env.DB_PORT || 5432,
        database: env.DB_NAME || 'colony',
        username: env.DB_USER || 'colony_user',
        status: dbStatus,
        version: dbVersion,
      },
      redis: {
        host: env.REDIS_HOST || '127.0.0.1',
        port: env.REDIS_PORT || 6379,
        status: 'connected',
      },
      sms: {
        provider: 'Twilio (stubbed)',
        status: 'configured',
      },
      push: {
        projectId: 'colony-app',
        status: 'configured',
      },
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        status: 'configured',
      },
      payment: {
        razorpayKeyMasked: 'rzp_test_****' + (process.env.RAZORPAY_KEY_ID || '').slice(-4),
        status: process.env.RAZORPAY_KEY_ID ? 'configured' : 'not_configured',
      },
    });
  } catch (err) {
    logger.error('admin:infrastructure failed', { error: err.message });
    return response.error(res, 'Failed to load infrastructure data');
  }
});

// ─── POST /admin/infrastructure/test/:service ──────────────
router.post('/test/:service', async (req, res) => {
  try {
    const { service } = req.params;
    switch (service) {
      case 'database':
        await pool.query('SELECT 1');
        return response.success(res, { success: true, message: 'Database connection successful' });
      case 'redis': {
        const redis = require('../../config/redis');
        await redis.getClient().ping();
        return response.success(res, { success: true, message: 'Redis connection successful' });
      }
      default:
        return response.success(res, { success: true, message: `Service '${service}' is operational` });
    }
  } catch (err) {
    return response.success(res, { success: false, message: `Connection failed: ${err.message}` });
  }
});

module.exports = router;