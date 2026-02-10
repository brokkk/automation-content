-- ============================================
-- AI Content Pipeline - Migration V2
-- Platform Configs & Telegram Settings
-- Run this AFTER schema.sql
-- ============================================

-- ============================================
-- NEW ENUMS
-- ============================================

-- Platform types (extended)
DO $$ BEGIN
  CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'threads', 'twitter');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tone types
DO $$ BEGIN
  CREATE TYPE content_tone AS ENUM ('casual', 'professional', 'humorous', 'informative', 'inspirational');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PLATFORM CONFIGS
-- Stores character/tone settings per platform
-- ============================================

CREATE TABLE IF NOT EXISTS platform_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform        social_platform NOT NULL UNIQUE,
  is_active       BOOLEAN DEFAULT true,
  
  -- Character Settings
  tone            content_tone DEFAULT 'casual',
  language        VARCHAR(10) DEFAULT 'id',
  use_emoji       BOOLEAN DEFAULT true,
  max_length      INTEGER DEFAULT 2200,
  
  -- Templates
  hashtags        TEXT DEFAULT '',
  cta_template    TEXT DEFAULT '',
  prompt_template TEXT DEFAULT '',
  
  -- Metadata
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TELEGRAM SETTINGS
-- Bot configuration for notifications
-- ============================================

CREATE TABLE IF NOT EXISTS telegram_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_token       TEXT NOT NULL,
  chat_id         TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT true,
  
  -- Notification Preferences
  notify_on_new_content     BOOLEAN DEFAULT true,
  notify_on_publish_success BOOLEAN DEFAULT true,
  notify_on_publish_error   BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPDATE RSS_SOURCES
-- Add category filter and keywords
-- ============================================

ALTER TABLE rss_sources 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS category_filter TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_generate BOOLEAN DEFAULT true;

-- ============================================
-- APP SETTINGS (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS app_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key             VARCHAR(100) NOT NULL UNIQUE,
  value           TEXT,
  is_encrypted    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_platform_configs_platform ON platform_configs(platform);
CREATE INDEX IF NOT EXISTS idx_telegram_settings_active ON telegram_settings(is_active);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated and anon
CREATE POLICY "Allow read platform_configs" ON platform_configs
  FOR SELECT USING (true);

CREATE POLICY "Allow all platform_configs" ON platform_configs
  FOR ALL USING (true);

CREATE POLICY "Allow read telegram_settings" ON telegram_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow all telegram_settings" ON telegram_settings
  FOR ALL USING (true);

-- ============================================
-- SEED DATA - Default Platform Configs
-- ============================================

INSERT INTO platform_configs (platform, tone, language, use_emoji, max_length, hashtags, cta_template, prompt_template)
VALUES 
  ('instagram', 'casual', 'id', true, 2200, 
   '#berita #viral #trending #info #news', 
   'Follow @yourbrand untuk update terbaru! 🔥',
   'Kamu adalah social media manager yang ahli membuat caption Instagram yang viral. Buatkan caption untuk berita berikut dengan gaya bahasa casual, menarik, dan mengundang engagement. Gunakan emoji yang relevan. Jangan terlalu panjang, maksimal 3 paragraf.

Berita:
{title}

{description}

Sumber: {source}'
  ),
  ('facebook', 'informative', 'id', true, 5000,
   '',
   'Bagikan ke teman-temanmu yang perlu tahu! 👇',
   'Kamu adalah content writer yang ahli membuat post Facebook yang informatif. Buatkan post untuk berita berikut dengan penjelasan yang lebih lengkap dan detail. Bisa lebih panjang dari Instagram.

Berita:
{title}

{description}

Sumber: {source}'
  )
ON CONFLICT (platform) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'Migration V2 completed successfully!' as status;
