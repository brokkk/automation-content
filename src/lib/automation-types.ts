import type { Database } from './database.types';

// Re-export existing types
export type ContentItem = Database['public']['Tables']['content_items']['Row'];
export type RssSource = Database['public']['Tables']['rss_sources']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];

// New types for automation
export type SocialPlatform = 'instagram' | 'facebook' | 'threads' | 'twitter';
export type ContentTone = 'casual' | 'professional' | 'humorous' | 'informative' | 'inspirational';

export interface PlatformConfig {
    id: string;
    platform: SocialPlatform;
    is_active: boolean;
    tone: ContentTone;
    language: string;
    use_emoji: boolean;
    max_length: number;
    hashtags: string;
    cta_template: string;
    prompt_template: string;
    created_at: string;
    updated_at: string;
}

export interface TelegramSettings {
    id: string;
    bot_token: string;
    chat_id: string;
    is_active: boolean;
    notify_on_new_content: boolean;
    notify_on_publish_success: boolean;
    notify_on_publish_error: boolean;
    created_at: string;
    updated_at: string;
}

export interface RssSourceExtended extends RssSource {
    keywords: string[];
    category_filter: string[];
    auto_generate: boolean;
}
