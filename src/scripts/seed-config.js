'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const CONFIG_ENTRIES = [
  // Authentication
  { key: 'auth_otp_length', value: 6, value_type: 'number', category: 'authentication', label: 'OTP Length', description: 'Number of digits in OTP code', min_value: 4, max_value: 8 },
  { key: 'auth_otp_expiry_seconds', value: 300, value_type: 'number', category: 'authentication', label: 'OTP Expiry (seconds)', description: 'Time before OTP expires', min_value: 60, max_value: 900 },
  { key: 'auth_otp_resend_cooldown', value: 60, value_type: 'number', category: 'authentication', label: 'OTP Resend Cooldown', description: 'Seconds before user can resend OTP', min_value: 10, max_value: 300 },
  { key: 'auth_max_otp_attempts', value: 5, value_type: 'number', category: 'authentication', label: 'Max OTP Attempts', description: 'Max wrong OTP attempts before lockout', min_value: 3, max_value: 10 },
  { key: 'auth_lockout_duration_minutes', value: 30, value_type: 'number', category: 'authentication', label: 'Lockout Duration (min)', description: 'Minutes locked after max attempts', min_value: 5, max_value: 1440 },
  { key: 'auth_min_age', value: 18, value_type: 'number', category: 'authentication', label: 'Minimum Age', description: 'Minimum user age', min_value: 13, max_value: 21 },
  { key: 'auth_name_min_length', value: 2, value_type: 'number', category: 'authentication', label: 'Name Min Length', description: 'Minimum display name length', min_value: 1, max_value: 10 },
  { key: 'auth_name_max_length', value: 50, value_type: 'number', category: 'authentication', label: 'Name Max Length', description: 'Maximum display name length', min_value: 10, max_value: 100 },
  { key: 'auth_profanity_filter_enabled', value: true, value_type: 'boolean', category: 'authentication', label: 'Profanity Filter', description: 'Filter profanity in names and bios' },

  // Features (tier-based)
  { key: 'feature_radar_enabled', value: JSON.stringify({ free: true, premium: true }), value_type: 'tier', category: 'features', label: 'Radar View', description: 'Show nearby users on radar', tier_values: JSON.stringify({ free: true, premium: true }) },
  { key: 'feature_stories_enabled', value: JSON.stringify({ free: true, premium: true }), value_type: 'tier', category: 'features', label: 'Stories', description: 'Allow users to post stories', tier_values: JSON.stringify({ free: true, premium: true }) },
  { key: 'feature_video_call_enabled', value: JSON.stringify({ free: false, premium: true }), value_type: 'tier', category: 'features', label: 'Video Calls', description: 'Enable video calling', tier_values: JSON.stringify({ free: false, premium: true }) },
  { key: 'feature_ghost_mode', value: JSON.stringify({ free: true, premium: true }), value_type: 'tier', category: 'features', label: 'Ghost Mode', description: 'Browse anonymously', tier_values: JSON.stringify({ free: true, premium: true }) },
  { key: 'feature_super_wave', value: JSON.stringify({ free: false, premium: true }), value_type: 'tier', category: 'features', label: 'Super Wave', description: 'Send super waves to stand out', tier_values: JSON.stringify({ free: false, premium: true }) },
  { key: 'feature_dating_enabled', value: JSON.stringify({ free: true, premium: true }), value_type: 'tier', category: 'features', label: 'Dating Features', description: 'Enable dating/matching features', tier_values: JSON.stringify({ free: true, premium: true }) },
  { key: 'feature_reels_enabled', value: JSON.stringify({ free: true, premium: true }), value_type: 'tier', category: 'features', label: 'Reels', description: 'Enable short video reels', tier_values: JSON.stringify({ free: true, premium: true }) },
  { key: 'feature_e2e_encryption', value: JSON.stringify({ free: false, premium: true }), value_type: 'tier', category: 'features', label: 'E2E Encryption', description: 'End-to-end encrypted messages', tier_values: JSON.stringify({ free: false, premium: true }) },

  // Discovery
  { key: 'proximity_radius_km_free', value: 5, value_type: 'number', category: 'discovery', label: 'Free User Radius (km)', description: 'Discovery radius for free users', min_value: 1, max_value: 50 },
  { key: 'proximity_radius_km_premium', value: 10, value_type: 'number', category: 'discovery', label: 'Premium User Radius (km)', description: 'Discovery radius for premium users', min_value: 1, max_value: 100 },

  // Waves
  { key: 'wave_daily_limit_free', value: 20, value_type: 'number', category: 'waves', label: 'Daily Wave Limit (Free)', description: 'Max waves per day for free users', min_value: 1, max_value: 100 },
  { key: 'wave_daily_limit_premium', value: 100, value_type: 'number', category: 'waves', label: 'Daily Wave Limit (Premium)', description: 'Max waves per day for premium users', min_value: 10, max_value: 1000 },

  // Stories
  { key: 'story_duration_hours', value: 24, value_type: 'number', category: 'stories', label: 'Story Duration (hours)', description: 'How long stories last', min_value: 1, max_value: 72 },

  // Profile
  { key: 'profile_max_photos', value: 6, value_type: 'number', category: 'profile', label: 'Max Profile Photos', description: 'Maximum photos per profile', min_value: 1, max_value: 20 },
  { key: 'profile_max_bio_length', value: 150, value_type: 'number', category: 'profile', label: 'Max Bio Length', description: 'Maximum characters in bio', min_value: 50, max_value: 500 },

  // UI
  { key: 'ui_home_tabs', value: JSON.stringify(['feed', 'radar', 'groups', 'chat', 'profile']), value_type: 'json', category: 'ui', label: 'Home Tab Order', description: 'Order of tabs in bottom navigation' },

  // Monetization
  { key: 'ads_enabled', value: false, value_type: 'boolean', category: 'monetization', label: 'Ads Enabled', description: 'Show ads to free users' },

  // System
  { key: 'maintenance_mode', value: false, value_type: 'boolean', category: 'system', label: 'Maintenance Mode', description: 'Enable maintenance mode (blocks all users)' },
  { key: 'force_update_version', value: '1.0.0', value_type: 'text', category: 'system', label: 'Force Update Version', description: 'Minimum app version required' },

  // Notifications
  { key: 'push_notifications_enabled', value: true, value_type: 'boolean', category: 'notifications', label: 'Push Notifications', description: 'Enable push notifications' },
  { key: 'notification_cooldown_seconds', value: 60, value_type: 'number', category: 'notifications', label: 'Notification Cooldown', description: 'Min seconds between notifications', min_value: 0, max_value: 3600 },

  // Chat
  { key: 'chat_max_message_length', value: 5000, value_type: 'number', category: 'chat', label: 'Max Message Length', description: 'Maximum characters per message', min_value: 100, max_value: 50000 },
  { key: 'chat_media_max_size_mb', value: 25, value_type: 'number', category: 'chat', label: 'Max Media Size (MB)', description: 'Maximum file upload size', min_value: 1, max_value: 100 },

  // Safety
  { key: 'max_reports_before_ban', value: 5, value_type: 'number', category: 'safety', label: 'Auto-Ban Report Threshold', description: 'Auto-suspend after N reports', min_value: 1, max_value: 50 },
  { key: 'block_limit', value: 100, value_type: 'number', category: 'safety', label: 'Block Limit', description: 'Max users one person can block', min_value: 10, max_value: 1000 },
];

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'colony',
    user: process.env.DB_USER || 'colony_user',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Check if table exists and has data
    const count = await pool.query('SELECT COUNT(*)::int AS cnt FROM remote_config');
    if (count.rows[0].cnt > 0) {
      console.log(`remote_config already has ${count.rows[0].cnt} entries — skipping seed`);
      await pool.end();
      return;
    }

    console.log(`Seeding ${CONFIG_ENTRIES.length} config entries...`);
    for (const entry of CONFIG_ENTRIES) {
      await pool.query(
        `INSERT INTO remote_config (key, value, value_type, category, label, description, tier_values, min_value, max_value)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7::jsonb, $8, $9)
         ON CONFLICT (key) DO NOTHING`,
        [
          entry.key,
          typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value),
          entry.value_type,
          entry.category,
          entry.label,
          entry.description || null,
          entry.tier_values || null,
          entry.min_value ?? null,
          entry.max_value ?? null,
        ]
      );
    }
    console.log(`Seeded ${CONFIG_ENTRIES.length} config entries`);
  } catch (e) {
    console.error('Seed failed:', e.message);
  } finally {
    await pool.end();
  }
}

seed();
