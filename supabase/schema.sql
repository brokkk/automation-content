-- ============================================
-- AI Content Pipeline - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE content_status AS ENUM (
  'incoming',
  'ai_generated',
  'draft',
  'waiting_approval',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'failed'
);

CREATE TYPE platform_type AS ENUM ('instagram', 'facebook', 'both');

CREATE TYPE llm_provider_type AS ENUM (
  'openai', 'anthropic', 'gemini', 'xai', 'openrouter', 'custom'
);

-- ============================================
-- TABLES
-- ============================================

-- Categories
CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  color           VARCHAR(7) DEFAULT '#6B7280',
  rules           JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RSS Sources
CREATE TABLE rss_sources (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  url               TEXT NOT NULL UNIQUE,
  favicon           TEXT,
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active         BOOLEAN DEFAULT true,
  fetch_interval    INTEGER DEFAULT 15,
  last_fetched      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Personas
CREATE TABLE personas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  tone            VARCHAR(50),
  prompt_template TEXT NOT NULL,
  is_default      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- LLM Providers
CREATE TABLE llm_providers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider        llm_provider_type NOT NULL,
  name            VARCHAR(100) NOT NULL,
  base_url        TEXT,
  default_model   VARCHAR(100) NOT NULL,
  fallback_model  VARCHAR(100),
  is_active       BOOLEAN DEFAULT true,
  is_default      BOOLEAN DEFAULT false,
  priority        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- LLM Runs (logs)
CREATE TABLE llm_runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id         UUID REFERENCES llm_providers(id) ON DELETE SET NULL,
  provider            llm_provider_type NOT NULL,
  model               VARCHAR(100) NOT NULL,
  prompt_hash         VARCHAR(64) NOT NULL,
  correlation_id      VARCHAR(36) NOT NULL,
  system_prompt       TEXT,
  user_prompt         TEXT NOT NULL,
  response_raw        TEXT,
  response_parsed     JSONB,
  validation_status   VARCHAR(20),
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  latency_ms          INTEGER,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message       TEXT,
  content_id          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Content Items (main table)
CREATE TABLE content_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id         UUID REFERENCES rss_sources(id) ON DELETE SET NULL,
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  persona_id        UUID REFERENCES personas(id) ON DELETE SET NULL,
  
  -- Original content
  original_title    TEXT NOT NULL,
  original_desc     TEXT,
  original_url      TEXT NOT NULL,
  original_image    TEXT,
  guid              TEXT UNIQUE,
  
  -- AI Generated content
  headline          TEXT,
  subheadline       TEXT,
  ig_caption        TEXT,
  fb_caption        TEXT,
  variations        JSONB DEFAULT '[]',
  ai_confidence     DECIMAL(3,2),
  selected_var      INTEGER DEFAULT 0,
  
  -- Status & scheduling
  status            content_status DEFAULT 'incoming',
  platform          platform_type DEFAULT 'both',
  scheduled_at      TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  
  -- Tracking
  llm_run_id        UUID REFERENCES llm_runs(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Media Assets
CREATE TABLE media_assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id      UUID REFERENCES content_items(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL,
  format          VARCHAR(20) NOT NULL,
  storage_path    TEXT NOT NULL,
  public_url      TEXT,
  template_id     UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Logs
CREATE TABLE approval_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id      UUID REFERENCES content_items(id) ON DELETE CASCADE,
  token           VARCHAR(64) UNIQUE NOT NULL,
  token_expires   TIMESTAMPTZ NOT NULL,
  action          VARCHAR(20),
  approved_by     UUID,
  ip_address      INET,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  actioned_at     TIMESTAMPTZ
);

-- Workflow Runs
CREATE TABLE workflow_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name   VARCHAR(50) NOT NULL,
  trigger_type    VARCHAR(20) NOT NULL,
  correlation_id  VARCHAR(36) NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending',
  input_data      JSONB,
  output_data     JSONB,
  error_log       TEXT,
  retry_count     INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Publish Logs
CREATE TABLE publish_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id      UUID REFERENCES content_items(id) ON DELETE SET NULL,
  platform        platform_type NOT NULL,
  external_id     TEXT,
  buffer_id       TEXT,
  status          VARCHAR(20) NOT NULL,
  response_data   JSONB,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- System Events (logging)
CREATE TABLE system_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type      VARCHAR(50) NOT NULL,
  severity        VARCHAR(10) NOT NULL,
  correlation_id  VARCHAR(36),
  source          VARCHAR(50) NOT NULL,
  message         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Image Templates
CREATE TABLE image_templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100) NOT NULL,
  slug              VARCHAR(50) UNIQUE NOT NULL,
  html_content      TEXT NOT NULL,
  supported_formats TEXT[] DEFAULT ARRAY['1080x1080'],
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_default        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_created ON content_items(created_at DESC);
CREATE INDEX idx_content_items_scheduled ON content_items(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_llm_runs_correlation ON llm_runs(correlation_id);
CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_created ON system_events(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_logs ENABLE ROW LEVEL SECURITY;

-- Public read for authenticated users
CREATE POLICY "Allow authenticated read" ON categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON rss_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON personas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON content_items
  FOR SELECT TO authenticated USING (true);

-- Service role has full access (for n8n, API routes)
CREATE POLICY "Service role full access" ON content_items
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access" ON llm_runs
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access" ON approval_logs
  FOR ALL TO service_role USING (true);

-- ============================================
-- SEED DATA
-- ============================================

-- Default categories
INSERT INTO categories (name, slug, color) VALUES
  ('Tech', 'tech', '#3B82F6'),
  ('Design', 'design', '#A855F7'),
  ('Finance', 'finance', '#22C55E'),
  ('Marketing', 'marketing', '#EC4899');

-- Default persona
INSERT INTO personas (name, description, tone, prompt_template, is_default) VALUES
  ('Professional', 'Clear, informative, trustworthy tone', 'professional',
   'You are a professional social media content writer. Create engaging captions that are clear, informative, and trustworthy. Use relevant hashtags and include a call to action.',
   true);

-- Default LLM provider
INSERT INTO llm_providers (provider, name, default_model, is_default, priority) VALUES
  ('openai', 'OpenAI GPT-4o', 'gpt-4o', true, 1),
  ('anthropic', 'Claude 3.5 Sonnet', 'claude-3-5-sonnet-20241022', false, 2),
  ('gemini', 'Gemini 2.0 Flash', 'gemini-2.0-flash-exp', false, 3);
