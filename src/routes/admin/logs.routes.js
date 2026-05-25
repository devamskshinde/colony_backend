'use strict';

const { Router } = require('express');
const { adminAuthenticate } = require('../../middleware/adminAuth.middleware');
const response = require('../../utils/response.utils');
const logger = require('../../utils/logger');
const { pool } = require('../../config/database');
const fs = require('fs');
const path = require('path');

const router = Router();
router.use(adminAuthenticate);

// ─── GET /admin/logs ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const { level, startDate, endDate, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (level) {
      where += ` AND status_code >= 400`; // approximate level filter
    }
    if (startDate) {
      where += ` AND created_at >= $${idx}`;
      params.push(startDate);
      idx++;
    }
    if (endDate) {
      where += ` AND created_at <= $${idx}`;
      params.push(endDate);
      idx++;
    }

    const [logsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, method, path, status_code, response_time_ms, ip_address,
                user_agent, request_id, created_at
         FROM api_logs ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM api_logs ${where}`, params),
    ]);

    const total = countRes.rows[0]?.total || 0;
    const entries = logsRes.rows.map((l) => ({
      id: l.id,
      timestamp: l.created_at,
      level: l.status_code >= 500 ? 'error' : l.status_code >= 400 ? 'warn' : 'info',
      user: l.ip_address || '—',
      action: `${l.method} ${l.path}`,
      ip: l.ip_address || '',
      details: `Status ${l.status_code} — ${l.response_time_ms}ms`,
      source: l.user_agent || '',
    }));

    return response.success(res, entries, 'Success', 200);
  } catch (err) {
    logger.error('admin:logs failed', { error: err.message });
    return response.error(res, 'Failed to fetch logs');
  }
});

module.exports = router;