'use strict';

const { Router } = require('express');
const { adminAuthenticate } = require('../../middleware/adminAuth.middleware');
const response = require('../../utils/response.utils');
const logger = require('../../utils/logger');
const { pool } = require('../../config/database');

const router = Router();
router.use(adminAuthenticate);

// GET /admin/dashboard — real-time dashboard stats
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      totalRes,
      onlineRes,
      newTodayRes,
      userGrowthRes,
      hourlyRes,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM users WHERE is_deleted = false'),
      pool.query("SELECT COUNT(*)::int AS online FROM users WHERE is_active = true AND is_deleted = false AND last_active_at > NOW() - INTERVAL '15 minutes'"),
      pool.query('SELECT COUNT(*)::int AS new_today FROM users WHERE created_at >= $1 AND is_deleted = false', [todayStart]),
      pool.query(`SELECT to_char(d.date, 'MM-DD') AS date, COALESCE(COUNT(u.id), 0)::int AS users
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day') AS d(date)
        LEFT JOIN users u ON u.created_at::date <= d.date::date AND u.is_deleted = false
        GROUP BY d.date ORDER BY d.date`),
      pool.query(`SELECT to_char(h.hour, 'HH24:00') AS hour, COALESCE(COUNT(u.id), 0)::int AS users
        FROM generate_series(0, 23) AS h(hour)
        LEFT JOIN users u ON EXTRACT(HOUR FROM u.last_active_at) = h.hour
          AND u.last_active_at::date = CURRENT_DATE AND u.is_active = true AND u.is_deleted = false
        GROUP BY h.hour ORDER BY h.hour`),
    ]);

    const totalUsers = totalRes.rows[0]?.total || 0;
    const onlineNow = onlineRes.rows[0]?.online || 0;
    const newToday = newTodayRes.rows[0]?.new_today || 0;

    // Derive approximate changes (previous day comparison)
    const prevDayRes = await pool.query(
      `SELECT COUNT(*)::int AS prev_new FROM users WHERE created_at >= $1 AND created_at < $2 AND is_deleted = false`,
      [new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString(), todayStart]
    );
    const prevNew = prevDayRes.rows[0]?.prev_new || 0;

    return response.success(res, {
      stats: {
        totalUsers,
        onlineNow,
        newToday,
        messagesPerHour: 0,
        activeGroups: 0,
        revenueToday: 0,
        changes: {
          totalUsers: Math.abs(newToday - prevNew),
          onlineNow: 0,
          newToday: prevNew,
          messagesPerHour: 0,
          activeGroups: 0,
          revenueToday: 0,
        },
      },
      userGrowth: userGrowthRes.rows,
      hourlyActive: hourlyRes.rows,
      alerts: [],
    });
  } catch (err) {
    logger.error('admin:dashboard failed', { error: err.message });
    return response.error(res, 'Failed to load dashboard data');
  }
});

module.exports = router;