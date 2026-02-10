import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper types
export interface ContentItem {
    id: string;
    original_title: string;
    original_desc: string | null;
    original_url: string;
    original_image: string | null;
    headline: string | null;
    subheadline: string | null;
    ig_caption: string | null;
    fb_caption: string | null;
    platform: string;
    status: string;
    source_id: string | null;
    category_id: string | null;
    ai_confidence: number | null;
    approval_token: string | null;
    scheduled_at: string | null;
    created_at: string;
    // New AI automation fields
    ai_score: number | null;
    score_breakdown: object | null;
    full_article_text: string | null;
    image_headline: string | null;
    image_subtext: string | null;
    image_cta: string | null;
}

export interface RssSource {
    id: string;
    name: string;
    url: string;
    is_active: boolean;
    keywords: string[];
    category_filter: string[];
    auto_generate: boolean;
}

export interface PlatformConfig {
    id: string;
    platform: string;
    is_active: boolean;
    tone: string;
    language: string;
    use_emoji: boolean;
    max_length: number;
    hashtags: string;
    cta_template: string;
    prompt_template: string;
}

export interface TelegramSettings {
    id: string;
    bot_token: string;
    chat_id: string;
    is_active: boolean;
    notify_on_new_content: boolean;
    notify_on_publish_success: boolean;
    notify_on_publish_error: boolean;
}
