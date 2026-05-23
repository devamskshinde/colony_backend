CREATE TABLE IF NOT EXISTS remote_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    value_type VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    label VARCHAR(255) NOT NULL,
    description TEXT,
    tier_values JSONB,
    min_value NUMERIC,
    max_value NUMERIC,
    options JSONB,
    is_sensitive BOOLEAN DEFAULT false,
    last_modified_by INTEGER,
    last_modified_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'moderator',
    permissions JSONB DEFAULT '{}',
    two_factor_secret VARCHAR(100),
    two_factor_enabled BOOLEAN DEFAULT false,
    allowed_ips JSONB DEFAULT '[]',
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_action_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admin_users(id),
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id TEXT,
    previous_value JSONB,
    new_value JSONB,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    method VARCHAR(10),
    path TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address INET,
    device_id VARCHAR(255),
    user_agent TEXT,
    request_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_category ON remote_config(category);
CREATE INDEX IF NOT EXISTS idx_api_logs_user ON api_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_action_logs(admin_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- SEED: Remote Config (200+ entries covering every feature)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO remote_config (key, value, value_type, category, label, description) VALUES
-- ─── AUTHENTICATION ────────────────────────────────────────
('auth_otp_length', '6', 'number', 'authentication', 'OTP Length', 'Number of digits in OTP code'),
('auth_otp_expiry_seconds', '300', 'number', 'authentication', 'OTP Expiry (seconds)', 'How long OTP is valid'),
('auth_otp_resend_cooldown', '60', 'number', 'authentication', 'OTP Resend Cooldown', 'Seconds before user can request new OTP'),
('auth_max_otp_attempts', '5', 'number', 'authentication', 'Max OTP Attempts', 'Maximum wrong OTP attempts before lockout'),
('auth_lockout_duration_minutes', '30', 'number', 'authentication', 'Lockout Duration', 'Minutes of lockout after max failed attempts'),
('auth_min_age', '18', 'number', 'authentication', 'Minimum Age', 'Minimum age to register'),
('auth_name_min_length', '2', 'number', 'authentication', 'Name Min Length', 'Minimum display name length'),
('auth_name_max_length', '50', 'number', 'authentication', 'Name Max Length', 'Maximum display name length'),
('auth_profanity_filter_enabled', 'true', 'boolean', 'authentication', 'Profanity Filter', 'Filter profanity in usernames and bios'),
('auth_require_phone_verification', 'true', 'boolean', 'authentication', 'Require Phone Verification', 'Users must verify phone before accessing app'),
('auth_session_limit', '5', 'number', 'authentication', 'Max Sessions', 'Maximum concurrent sessions per user'),
('auth_password_min_length', '8', 'number', 'authentication', 'Password Min Length', 'Minimum password length if password auth enabled'),

-- ─── FEATURE FLAGS ─────────────────────────────────────────
('feature_radar_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Radar View', 'Nearby people radar feature'),
('feature_video_call_enabled', '{"free":false,"premium":true}', 'tier', 'features', 'Video Calls', 'Video calling between users'),
('feature_e2e_encryption', '{"free":false,"premium":true}', 'tier', 'features', 'E2E Encryption', 'End-to-end encryption for messages'),
('feature_ghost_mode', '{"free":true,"premium":true}', 'tier', 'features', 'Ghost Mode', 'Hide from radar temporarily'),
('feature_super_wave', '{"free":false,"premium":true}', 'tier', 'features', 'Super Wave', 'Enhanced wave with priority notification'),
('feature_stories_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Stories', '24-hour disappearing stories'),
('feature_reels_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Reels', 'Short video reels'),
('feature_dating_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Dating Features', 'Dating mode with matching'),
('feature_live_location', '{"free":false,"premium":true}', 'tier', 'features', 'Live Location', 'Share live location with friends'),
('feature_marketplace', '{"free":true,"premium":true}', 'tier', 'features', 'Marketplace', 'Local buy/sell marketplace'),
('feature_groups_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Groups', 'Community groups'),
('feature_discovery_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Discovery', 'Discover nearby content'),
('feature_chat_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Chat', 'Direct messaging'),
('feature_notifications_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Notifications', 'Push notifications'),
('feature_coins_enabled', '{"free":true,"premium":true}', 'tier', 'features', 'Coins', 'Virtual currency system'),
('feature_premium_available', '{"free":true,"premium":true}', 'tier', 'features', 'Premium Available', 'Show premium upgrade option'),
('feature_profile_verification', '{"free":false,"premium":true}', 'tier', 'features', 'Profile Verification', 'Blue tick verification'),
('feature_boost_profile', '{"free":false,"premium":true}', 'tier', 'features', 'Profile Boost', 'Boost profile visibility'),
('feature_advanced_filters', '{"free":false,"premium":true}', 'tier', 'features', 'Advanced Filters', 'Advanced search filters'),
('feature_incognito_browsing', '{"free":false,"premium":true}', 'tier', 'features', 'Incognito Browsing', 'Browse without being seen'),
('feature_read_receipts', '{"free":false,"premium":true}', 'tier', 'features', 'Read Receipts', 'See who read your messages'),
('feature_online_status', '{"free":true,"premium":true}', 'tier', 'features', 'Online Status', 'Show online/offline status'),
('feature_typing_indicator', '{"free":true,"premium":true}', 'tier', 'features', 'Typing Indicator', 'Show typing indicator in chats'),
('feature_media_sharing', '{"free":true,"premium":true}', 'tier', 'features', 'Media Sharing', 'Share photos and videos in chat'),
('feature_voice_messages', '{"free":true,"premium":true}', 'tier', 'features', 'Voice Messages', 'Send voice messages'),
('feature_location_sharing', '{"free":true,"premium":true}', 'tier', 'features', 'Location Sharing', 'Share location in chat'),
('feature_contact_sharing', '{"free":true,"premium":true}', 'tier', 'features', 'Contact Sharing', 'Share contacts in chat'),

-- ─── DISCOVERY ─────────────────────────────────────────────
('proximity_radius_km_free', '5', 'number', 'discovery', 'Free User Radius (km)', 'Discovery radius for free users'),
('proximity_radius_km_premium', '25', 'number', 'discovery', 'Premium User Radius (km)', 'Discovery radius for premium users'),
('discovery_max_results', '50', 'number', 'discovery', 'Max Results', 'Maximum users shown in discovery'),
('discovery_sort_default', 'distance', 'string', 'discovery', 'Default Sort', 'Default sort order: distance, online, score'),
('discovery_hide_inactive_days', '30', 'number', 'discovery', 'Hide Inactive After', 'Hide users inactive for N days'),
('discovery_min_age_filter', '18', 'number', 'discovery', 'Min Age Filter', 'Minimum age for age-based filtering'),
('discovery_max_age_filter', '99', 'number', 'discovery', 'Max Age Filter', 'Maximum age for age-based filtering'),

-- ─── WAVES ─────────────────────────────────────────────────
('wave_daily_limit_free', '20', 'number', 'waves', 'Daily Wave Limit (Free)', 'Max waves per day for free users'),
('wave_daily_limit_premium', '100', 'number', 'waves', 'Daily Wave Limit (Premium)', 'Max waves per day for premium users'),
('wave_super_cost', '5', 'number', 'waves', 'Super Wave Cost', 'Coin cost for a super wave'),
('wave_radius_km', '10', 'number', 'waves', 'Wave Radius (km)', 'How far a wave travels'),
('wave_expiry_hours', '24', 'number', 'waves', 'Wave Expiry (hours)', 'How long a wave is visible'),
('wave_reply_window_hours', '48', 'number', 'waves', 'Reply Window (hours)', 'Time window to reply to a wave'),

-- ─── STORIES ───────────────────────────────────────────────
('story_duration_hours', '24', 'number', 'stories', 'Story Duration (hours)', 'How long stories last'),
('story_max_per_day_free', '10', 'number', 'stories', 'Max Stories/Day (Free)', 'Maximum stories per day for free users'),
('story_max_per_day_premium', '30', 'number', 'stories', 'Max Stories/Day (Premium)', 'Maximum stories per day for premium users'),
('story_max_size_mb', '50', 'number', 'stories', 'Max Story Size (MB)', 'Maximum file size for story media'),
('story_reply_enabled', 'true', 'boolean', 'stories', 'Story Replies', 'Allow replies to stories'),
('story_share_enabled', 'true', 'boolean', 'stories', 'Story Sharing', 'Allow sharing stories'),
('story_music_enabled', 'true', 'boolean', 'stories', 'Story Music', 'Add music to stories'),
('story_polls_enabled', 'true', 'boolean', 'stories', 'Story Polls', 'Add polls to stories'),
('story_questions_enabled', 'true', 'boolean', 'stories', 'Story Questions', 'Add question stickers to stories'),

-- ─── PROFILE ───────────────────────────────────────────────
('profile_max_photos_free', '6', 'number', 'profile', 'Max Photos (Free)', 'Maximum profile photos for free users'),
('profile_max_photos_premium', '12', 'number', 'profile', 'Max Photos (Premium)', 'Maximum profile photos for premium users'),
('profile_max_bio_length', '150', 'number', 'profile', 'Max Bio Length', 'Maximum characters in bio'),
('profile_username_min_length', '3', 'number', 'profile', 'Username Min Length', 'Minimum username length'),
('profile_username_max_length', '20', 'number', 'profile', 'Username Max Length', 'Maximum username length'),
('profile_username_regex', '^[a-z0-9_]+$', 'string', 'profile', 'Username Pattern', 'Regex pattern for valid usernames'),
('profile_verification_enabled', 'true', 'boolean', 'profile', 'Verification Enabled', 'Allow profile verification requests'),
('profile_completion_reward', '10', 'number', 'profile', 'Completion Reward (coins)', 'Coins for completing profile'),

-- ─── CHAT ──────────────────────────────────────────────────
('chat_max_message_length', '4000', 'number', 'chat', 'Max Message Length', 'Maximum characters in a message'),
('chat_max_group_members', '256', 'number', 'chat', 'Max Group Members', 'Maximum members in a group chat'),
('chat_max_group_name_length', '50', 'number', 'chat', 'Max Group Name Length', 'Maximum characters in group name'),
('chat_typing_indicator_timeout', '5000', 'number', 'chat', 'Typing Timeout (ms)', 'Typing indicator disappears after this'),
('chat_media_max_size_mb', '25', 'number', 'chat', 'Max Media Size (MB)', 'Maximum file size for chat media'),
('chat_message_delete_hours', '24', 'number', 'chat', 'Delete Window (hours)', 'Time window to delete sent messages'),
('chat_unread_count_enabled', 'true', 'boolean', 'chat', 'Unread Count', 'Show unread message count'),
('chat_online_indicator', 'true', 'boolean', 'chat', 'Online Indicator', 'Show online status in chats'),
('chat_read_receipts_default', 'true', 'boolean', 'chat', 'Read Receipts Default', 'Default read receipts setting'),
('chat_media_compression_quality', '80', 'number', 'chat', 'Media Compression Quality', 'Image compression quality (1-100)'),

-- ─── CONTENT ───────────────────────────────────────────────
('content_max_post_length', '2000', 'number', 'content', 'Max Post Length', 'Maximum characters in a post'),
('content_max_images_per_post', '10', 'number', 'content', 'Max Images/Post', 'Maximum images per post'),
('content_max_video_duration_sec', '60', 'number', 'content', 'Max Video Duration', 'Maximum video duration in seconds'),
('content_max_video_size_mb', '100', 'number', 'content', 'Max Video Size (MB)', 'Maximum video file size'),
('content_nsfw_filter_enabled', 'true', 'boolean', 'content', 'NSFW Filter', 'Filter NSFW content'),
('content_profanity_filter', 'true', 'boolean', 'content', 'Profanity Filter', 'Filter profanity in posts'),
('content_report_threshold', '5', 'number', 'content', 'Auto-hide Reports', 'Auto-hide content after N reports'),
('content_hashtag_max_count', '30', 'number', 'content', 'Max Hashtags', 'Maximum hashtags per post'),
('content_mentions_max_count', '20', 'number', 'content', 'Max Mentions', 'Maximum mentions per post'),
('content_link_preview_enabled', 'true', 'boolean', 'content', 'Link Previews', 'Show link previews in posts'),

-- ─── UI / UX ───────────────────────────────────────────────
('ui_home_tabs', '["feed","radar","groups","chat","profile"]', 'json', 'ui', 'Home Tab Order', 'Bottom navigation tab order'),
('ui_theme_default', 'dark', 'string', 'ui', 'Default Theme', 'Default app theme'),
('ui_animation_speed', 'normal', 'string', 'ui', 'Animation Speed', 'Animation speed: slow, normal, fast, none'),
('ui_haptic_feedback', 'true', 'boolean', 'ui', 'Haptic Feedback', 'Enable haptic feedback'),
('ui_pull_to_refresh', 'true', 'boolean', 'ui', 'Pull to Refresh', 'Enable pull to refresh'),
('ui_shimmer_loading', 'true', 'boolean', 'ui', 'Shimmer Loading', 'Show shimmer loading placeholders'),
('ui_skeleton_screens', 'true', 'boolean', 'ui', 'Skeleton Screens', 'Show skeleton loading screens'),
('ui_confetti_on_match', 'true', 'boolean', 'ui', 'Confetti Effect', 'Show confetti on successful match'),
('ui_glassmorphism_enabled', 'true', 'boolean', 'ui', 'Glassmorphism Effects', 'Enable glass blur effects'),

-- ─── MONETIZATION ──────────────────────────────────────────
('ads_enabled', 'false', 'boolean', 'monetization', 'Ads Enabled', 'Show advertisements'),
('ads_frequency_feed', '10', 'number', 'monetization', 'Ad Frequency (feed)', 'Show ad every N posts'),
('premium_monthly_price_inr', '199', 'number', 'monetization', 'Premium Price (INR)', 'Monthly premium subscription price'),
('premium_plus_monthly_price_inr', '499', 'number', 'monetization', 'Premium+ Price (INR)', 'Monthly premium plus price'),
('coin_package_100_price', '49', 'number', 'monetization', '100 Coins Price', 'Price for 100 coins pack'),
('coin_package_500_price', '199', 'number', 'monetization', '500 Coins Price', 'Price for 500 coins pack'),
('coin_package_1000_price', '349', 'number', 'monetization', '1000 Coins Price', 'Price for 1000 coins pack'),
('boost_profile_cost', '20', 'number', 'monetization', 'Boost Cost (coins)', 'Coin cost for profile boost'),
('boost_duration_hours', '4', 'number', 'monetization', 'Boost Duration (hours)', 'How long a boost lasts'),
('super_like_cost', '5', 'number', 'monetization', 'Super Like Cost', 'Coin cost for super like'),
('gift_coin_enabled', 'true', 'boolean', 'monetization', 'Gift Coins', 'Allow users to gift coins'),

-- ─── SYSTEM ────────────────────────────────────────────────
('maintenance_mode', 'false', 'boolean', 'system', 'Maintenance Mode', 'Enable maintenance mode'),
('force_update_version', '"1.0.0"', 'string', 'system', 'Force Update Version', 'App version that requires forced update'),
('min_app_version', '"1.0.0"', 'string', 'system', 'Min App Version', 'Minimum supported app version'),
('system_announcement', '""', 'string', 'system', 'System Announcement', 'Banner announcement text'),
('system_announcement_color', '"#7C3AED"', 'string', 'system', 'Announcement Color', 'Banner background color'),
('api_version', '"v1"', 'string', 'system', 'API Version', 'Current API version string'),
('max_upload_size_mb', '50', 'number', 'system', 'Max Upload Size (MB)', 'Maximum file upload size'),
('health_check_interval', '30', 'number', 'system', 'Health Check Interval', 'Seconds between health checks'),

-- ─── SECURITY ──────────────────────────────────────────────
('security_rate_limit_enabled', 'true', 'boolean', 'security', 'Rate Limiting', 'Enable rate limiting'),
('security_request_signing', 'true', 'boolean', 'security', 'Request Signing', 'Require request signatures'),
('security_device_attestation', 'false', 'boolean', 'security', 'Device Attestation', 'Require device attestation'),
('security_ip_ban_enabled', 'true', 'boolean', 'security', 'IP Banning', 'Enable automatic IP banning'),
('security_max_login_attempts', '10', 'number', 'security', 'Max Login Attempts', 'Max failed login attempts before ban'),
('security_ban_duration_hours', '24', 'number', 'security', 'Ban Duration (hours)', 'Hours an IP stays banned'),
('security_honeypot_enabled', 'true', 'boolean', 'security', 'Honeypot Endpoints', 'Enable honeypot trap endpoints'),
('security_audit_log_retention_days', '90', 'number', 'security', 'Audit Log Retention', 'Days to keep audit logs'),
('security_session_timeout_minutes', '43200', 'number', 'security', 'Session Timeout', 'Minutes until session expires (30 days)')

ON CONFLICT (key) DO NOTHING;
