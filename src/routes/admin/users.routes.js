'use strict';

const { Router } = require('express');
const { adminAuthenticate } = require('../../middleware/adminAuth.middleware');
const response = require('../../utils/response.utils');
const logger = require('../../utils/logger');
const { pool } = require('../../config/database');

const router = Router();
router.use(adminAuthenticate);

// ─── GET /admin/users ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { search, status, colonyId, sortBy, sortOrder } = req.query;

    let where = 'WHERE u.is_deleted = false';
    const params = [];
    let paramIdx = 1;

    if (search) {
      where += ` AND (u.display_name ILIKE $${paramIdx} OR u.phone ILIKE $${paramIdx} OR u.username ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status) {
      switch (status) {
        case 'online':
          where += ` AND u.is_active = true AND u.last_active_at > NOW() - INTERVAL '15 minutes'`;
          break;
        case 'suspended':
          where += ' AND u.is_suspended = true';
          break;
        case 'shadow_banned':
          where += ' AND u.is_shadow_banned = true';
          break;
        case 'banned':
          where += ` AND u.is_suspended = true AND u.suspension_until IS NULL OR u.suspension_until > NOW()`;
          break;
      }
    }

    if (colonyId) {
      where += ` AND u.current_geohash IS NOT NULL`;
    }

    const orderColumn = {
      display_name: 'u.display_name',
      username: 'u.username',
      created_at: 'u.created_at',
      last_active_at: 'u.last_active_at',
      colony_score: 'u.colony_score',
    }[sortBy] || 'u.created_at';

    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [usersRes, countRes] = await Promise.all([
      pool.query(
        `SELECT u.id, u.phone, u.display_name AS name, u.username,
                u.profile_photo_url AS avatar, u.subscription_tier AS tier,
                u.is_suspended, u.is_shadow_banned, u.is_active,
                u.colony_score AS "colonyScore", u.last_active_at AS "lastActive",
                u.created_at AS "joinedAt"
         FROM users u ${where}
         ORDER BY ${orderColumn} ${orderDir}
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params),
    ]);

    const total = countRes.rows[0]?.total || 0;

    // Map DB fields to UserListItem
    const users = usersRes.rows.map((u) => {
      let statusLabel = 'offline';
      if (u.is_suspended && (!u.suspension_until || new Date(u.suspension_until) > new Date())) {
        statusLabel = 'banned';
      } else if (u.is_suspended) {
        statusLabel = 'suspended';
      } else if (u.is_shadow_banned) {
        statusLabel = 'shadow_banned';
      } else if (u.is_active && u.lastActive && (new Date() - new Date(u.lastActive)) < 15 * 60 * 1000) {
        statusLabel = 'online';
      }

      return {
        id: u.id,
        phone: u.phone,
        name: u.name || 'Unknown',
        username: u.username || '',
        avatar: u.avatar || undefined,
        tier: u.tier || 'free',
        status: statusLabel,
        colonyScore: u.colonyScore || 0,
        lastActive: u.lastActive ? new Date(u.lastActive).toISOString() : '',
        joinedAt: u.joinedAt ? new Date(u.joinedAt).toISOString() : '',
      };
    });

    return response.success(res, users, 'Success', 200);
  } catch (err) {
    logger.error('admin:getUsers failed', { error: err.message });
    return response.error(res, 'Failed to fetch users');
  }
});

// ─── GET /admin/users/:id ──────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, phone, display_name AS name, username, email,
              profile_photo_url AS avatar, bio,
              subscription_tier AS tier, colony_score AS "colonyScore",
              colony_coins AS coins, is_verified_phone AS verified,
              is_suspended, is_shadow_banned, is_active,
              current_location,
              created_at AS "joinedAt", last_active_at AS "lastActive"
       FROM users WHERE id = $1 AND is_deleted = false`,
      [id]
    );

    const u = result.rows[0];
    if (!u) return response.notFound(res, 'User not found');

    let location = undefined;
    if (u.current_location) {
      try {
        const locRes = await pool.query(
          `SELECT ST_Y(current_location::geometry) AS lat, ST_X(current_location::geometry) AS lng FROM users WHERE id = $1`,
          [id]
        );
        const loc = locRes.rows[0];
        if (loc) location = { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng), city: '' };
      } catch { /* ignore */ }
    }

    let statusLabel = 'offline';
    if (u.is_suspended) statusLabel = 'suspended';
    else if (u.is_shadow_banned) statusLabel = 'shadow_banned';
    else if (u.is_active) statusLabel = 'online';

    const profile = {
      id: u.id,
      name: u.name || 'Unknown',
      phone: u.phone,
      email: u.email || undefined,
      username: u.username || '',
      avatar: u.avatar || undefined,
      bio: u.bio || undefined,
      status: statusLabel,
      tier: u.tier || 'free',
      colonyScore: u.colonyScore || 0,
      coins: u.coins || 0,
      joinedAt: u.joinedAt ? new Date(u.joinedAt).toISOString() : '',
      lastActive: u.lastActive ? new Date(u.lastActive).toISOString() : '',
      verified: u.verified,
      location,
    };

    return response.success(res, profile);
  } catch (err) {
    logger.error('admin:getUser failed', { error: err.message, id: req.params.id });
    return response.error(res, 'Failed to fetch user');
  }
});

// ─── PATCH /admin/users/:id ────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, banReason, isVerified, display_name, bio } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (isBanned !== undefined) {
      updates.push(`is_suspended = $${idx}`);
      values.push(isBanned);
      idx++;
      if (isBanned) {
        updates.push(`suspension_until = NULL`);
      }
    }
    if (isVerified !== undefined) {
      updates.push(`is_verified_phone = $${idx}`);
      values.push(isVerified);
      idx++;
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${idx}`);
      values.push(display_name);
      idx++;
    }
    if (bio !== undefined) {
      updates.push(`bio = $${idx}`);
      values.push(bio);
      idx++;
    }

    if (updates.length === 0) return response.badRequest(res, 'No changes provided');

    updates.push('updated_at = NOW()');
    values.push(id);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    // Log admin action
    try {
      await pool.query(
        `INSERT INTO admin_action_logs (admin_id, action_type, target_type, target_id, new_value, ip_address)
         VALUES ($1, $2, 'user', $3, $4, $5)`,
        [req.admin.id, 'user_update', id, JSON.stringify(req.body), req.ip]
      );
    } catch { /* non-critical */ }

    return response.success(res, null, 'User updated');
  } catch (err) {
    logger.error('admin:updateUser failed', { error: err.message, id: req.params?.id });
    return response.error(res, 'Failed to update user');
  }
});

// ─── POST /admin/users/:id/action ──────────────────────────
router.post('/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    // Check user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND is_deleted = false', [id]);
    if (!userCheck.rows[0]) return response.notFound(res, 'User not found');

    let actionType = action;
    switch (action) {
      case 'suspend':
        await pool.query('UPDATE users SET is_suspended = true, suspension_until = NULL, updated_at = NOW() WHERE id = $1', [id]);
        break;
      case 'shadow_ban':
        await pool.query('UPDATE users SET is_shadow_banned = true, updated_at = NOW() WHERE id = $1', [id]);
        break;
      case 'ban':
        await pool.query('UPDATE users SET is_suspended = true, suspension_until = NULL, updated_at = NOW() WHERE id = $1', [id]);
        break;
      case 'lift_restrictions':
        await pool.query('UPDATE users SET is_suspended = false, is_shadow_banned = false, suspension_until = NULL, updated_at = NOW() WHERE id = $1', [id]);
        break;
      case 'delete':
        await pool.query('UPDATE users SET is_deleted = true, deleted_at = NOW() WHERE id = $1', [id]);
        break;
      case 'grant_premium':
        await pool.query(
          `UPDATE users SET subscription_tier = 'premium', subscription_expires_at = NOW() + INTERVAL '30 days', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        break;
      case 'revoke_premium':
        await pool.query(`UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL, updated_at = NOW() WHERE id = $1`, [id]);
        break;
      case 'grant_coins': {
        const { amount } = req.body;
        await pool.query(`UPDATE users SET colony_coins = colony_coins + $1, updated_at = NOW() WHERE id = $2`, [amount || 100, id]);
        break;
      }
      case 'deduct_coins': {
        const { amount } = req.body;
        await pool.query(`UPDATE users SET colony_coins = GREATEST(0, colony_coins - $1), updated_at = NOW() WHERE id = $2`, [amount || 100, id]);
        break;
      }
      case 'verify':
        await pool.query('UPDATE users SET is_verified_phone = true, updated_at = NOW() WHERE id = $1', [id]);
        break;
      case 'unverify':
        await pool.query('UPDATE users SET is_verified_phone = false, updated_at = NOW() WHERE id = $1', [id]);
        break;
      default:
        return response.badRequest(res, `Unknown action: ${action}`);
    }

    // Log
    try {
      await pool.query(
        `INSERT INTO admin_action_logs (admin_id, action_type, target_type, target_id, metadata, ip_address)
         VALUES ($1, $2, 'user', $3, $4, $5)`,
        [req.admin.id, actionType, id, JSON.stringify({ action, reason }), req.ip]
      );
    } catch { /* non-critical */ }

    return response.success(res, null, `Action '${action}' executed`);
  } catch (err) {
    logger.error('admin:userAction failed', { error: err.message, id: req.params?.id });
    return response.error(res, 'Failed to execute action');
  }
});

module.exports = router;