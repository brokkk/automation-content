-- ============================================
-- AI Content Pipeline - Add More Categories
-- Run this in Supabase SQL Editor
-- ============================================

INSERT INTO categories (name, slug, color, is_active)
VALUES 
  ('Technology', 'technology', '#3B82F6', true),
  ('Business', 'business', '#10B981', true),
  ('Finance', 'finance', '#F59E0B', true),
  ('Startup', 'startup', '#8B5CF6', true),
  ('Crypto', 'crypto', '#EC4899', true),
  ('AI & Machine Learning', 'ai-ml', '#06B6D4', true),
  ('Gadget', 'gadget', '#6366F1', true),
  ('Gaming', 'gaming', '#EF4444', true),
  ('Entertainment', 'entertainment', '#F97316', true),
  ('Lifestyle', 'lifestyle', '#84CC16', true),
  ('Health', 'health', '#14B8A6', true),
  ('Sports', 'sports', '#22C55E', true),
  ('Automotive', 'automotive', '#A855F7', true),
  ('Travel', 'travel', '#0EA5E9', true),
  ('Food', 'food', '#F43F5E', true),
  ('Science', 'science', '#7C3AED', true),
  ('Education', 'education', '#2563EB', true),
  ('Politics', 'politics', '#DC2626', true),
  ('Economy', 'economy', '#059669', true),
  ('Property', 'property', '#D97706', true)
ON CONFLICT (slug) DO NOTHING;

SELECT name, slug, color FROM categories ORDER BY name;
