-- ============================================
-- AI Content Pipeline - Full Automation Columns
-- Run this in Supabase SQL Editor
-- ============================================

-- Add AI scoring columns
ALTER TABLE content_items 
ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}';

-- Add full article storage
ALTER TABLE content_items 
ADD COLUMN IF NOT EXISTS full_article_text TEXT;

-- Add image copy columns
ALTER TABLE content_items 
ADD COLUMN IF NOT EXISTS image_headline VARCHAR(100),
ADD COLUMN IF NOT EXISTS image_subtext VARCHAR(200),
ADD COLUMN IF NOT EXISTS image_cta VARCHAR(100);

-- Create index for score-based queries
CREATE INDEX IF NOT EXISTS idx_content_items_ai_score 
ON content_items(ai_score DESC);

-- Add automation settings table
CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO automation_settings (setting_key, setting_value, description)
VALUES 
  ('min_score_threshold', '60', 'Minimum AI score to process article'),
  ('max_articles_per_crawl', '5', 'Max articles to generate per crawl'),
  ('auto_approve_threshold', '0', 'Auto-approve if score above this (0 = disabled)')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Allow all for automation_settings" ON automation_settings;
CREATE POLICY "Allow all for automation_settings" ON automation_settings
  FOR ALL USING (true) WITH CHECK (true);

SELECT 'Migration complete! New columns and settings added.' as status;
