'use strict';

const logger = require('../utils/logger');
const log = logger.child({ service: 'user' });

let db = null;

function init(dbPool) {
  db = dbPool;
  log.info('User service initialized');
}

/**
 * Get user profile by ID
 */
async function getProfile(userId) {
  try {
    const result = await db.query(
      `SELECT id, phone, display_name, username, bio, gender, date_of_birth,
              profile_photo_url, photos, interests, colony_score, subscription_tier,
              colony_coins, is_verified_phone, created_at, last_active_at
       FROM users WHERE id = $1 AND is_deleted = false`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (err) {
    log.error('Failed to get profile', { userId, error: err.message });
    throw err;
  }
}

/**
 * Update user profile
 */
async function updateProfile(userId, fields) {
  const allowed = ['display_name', 'bio', 'gender', 'date_of_birth', 'interests', 'profile_photo_url'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      updates.push(`${key} = $${idx}`);
      values.push(key === 'interests' ? JSON.stringify(value) : value);
      idx++;
    }
  }

  if (updates.length === 0) return getProfile(userId);

  updates.push(`updated_at = NOW()`);
  values.push(userId);

  try {
    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (err) {
    log.error('Failed to update profile', { userId, error: err.message });
    throw err;
  }
}

/**
 * Update user avatar
 */
async function updateAvatar(userId, avatarUrl) {
  try {
    const result = await db.query(
      'UPDATE users SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [avatarUrl, userId]
    );
    return result.rows[0];
  } catch (err) {
    log.error('Failed to update avatar', { userId, error: err.message });
    throw err;
  }
}

/**
 * Update FCM token
 */
async function updateFcmToken(userId, fcmToken) {
  try {
    await db.query(
      'UPDATE users SET notification_token = $1 WHERE id = $2',
      [fcmToken, userId]
    );
  } catch (err) {
    log.error('Failed to update FCM token', { userId, error: err.message });
    throw err;
  }
}

/**
 * Search users by name or username
 */
async function searchUsers(query, limit = 20) {
  try {
    const result = await db.query(
      `SELECT id, display_name, username, profile_photo_url
       FROM users WHERE is_active = true AND is_deleted = false
       AND (display_name ILIKE $1 OR username ILIKE $1)
       LIMIT $2`,
      [`%${query}%`, limit]
    );
    return result.rows;
  } catch (err) {
    log.error('Failed to search users', { query, error: err.message });
    throw err;
  }
}

/**
 * Soft delete user account
 */
async function softDeleteAccount(userId) {
  try {
    await db.query(
      'UPDATE users SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
      [userId]
    );
  } catch (err) {
    log.error('Failed to delete account', { userId, error: err.message });
    throw err;
  }
}

module.exports = {
  init,
  getProfile,
  updateProfile,
  updateAvatar,
  updateFcmToken,
  searchUsers,
  softDeleteAccount,
};
