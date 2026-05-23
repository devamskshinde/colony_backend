CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    phone_verified BOOLEAN DEFAULT false,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    username VARCHAR(50) UNIQUE,
    bio TEXT,
    gender VARCHAR(50),
    date_of_birth DATE,
    profile_photo_url TEXT,
    photos JSONB DEFAULT '[]',
    interests JSONB DEFAULT '[]',
    current_geohash VARCHAR(12),
    current_location GEOGRAPHY(POINT, 4326),
    location_updated_at TIMESTAMPTZ,
    colony_score INTEGER DEFAULT 0,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    colony_coins INTEGER DEFAULT 0,
    is_verified_phone BOOLEAN DEFAULT false,
    is_verified_face BOOLEAN DEFAULT false,
    is_verified_aadhaar BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_suspended BOOLEAN DEFAULT false,
    suspension_until TIMESTAMPTZ,
    is_shadow_banned BOOLEAN DEFAULT false,
    shadow_ban_type VARCHAR(50),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    notification_token TEXT,
    app_version VARCHAR(20),
    platform VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_geohash ON users(current_geohash);
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active_geo ON users(is_active, current_geohash) WHERE is_active = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm ON users USING gin(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin(username gin_trgm_ops);
