import { supabase } from './supabase';
import type { PlatformConfig, TelegramSettings, SocialPlatform } from './automation-types';

// ============================================
// PLATFORM CONFIGS
// ============================================

export async function getPlatformConfigs(): Promise<PlatformConfig[]> {
    const { data, error } = await supabase
        .from('platform_configs')
        .select('*')
        .order('platform');

    if (error) {
        console.error('Error fetching platform configs:', error);
        return [];
    }

    return data || [];
}

export async function getPlatformConfig(platform: SocialPlatform): Promise<PlatformConfig | null> {
    const { data, error } = await supabase
        .from('platform_configs')
        .select('*')
        .eq('platform', platform)
        .single();

    if (error) {
        console.error('Error fetching platform config:', error);
        return null;
    }

    return data;
}

export async function updatePlatformConfig(
    platform: SocialPlatform,
    updates: Partial<PlatformConfig>
): Promise<PlatformConfig | null> {
    const { data, error } = await supabase
        .from('platform_configs')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('platform', platform)
        .select()
        .single();

    if (error) {
        console.error('Error updating platform config:', error);
        return null;
    }

    return data;
}

// ============================================
// TELEGRAM SETTINGS
// ============================================

export async function getTelegramSettings(): Promise<TelegramSettings | null> {
    const { data, error } = await supabase
        .from('telegram_settings')
        .select('*')
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching telegram settings:', error);
        return null;
    }

    return data;
}

export async function saveTelegramSettings(
    settings: Partial<TelegramSettings>
): Promise<TelegramSettings | null> {
    // Check if settings exist
    const existing = await getTelegramSettings();

    if (existing) {
        // Update
        const { data, error } = await supabase
            .from('telegram_settings')
            .update({
                ...settings,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating telegram settings:', error);
            return null;
        }

        return data;
    } else {
        // Insert
        const { data, error } = await supabase
            .from('telegram_settings')
            .insert(settings)
            .select()
            .single();

        if (error) {
            console.error('Error inserting telegram settings:', error);
            return null;
        }

        return data;
    }
}

export async function testTelegramConnection(botToken: string, chatId: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: '✅ *Connection Test Successful!*\n\nYour AI Content Pipeline is now connected to this chat.',
                    parse_mode: 'Markdown',
                }),
            }
        );

        const result = await response.json();
        return result.ok === true;
    } catch (error) {
        console.error('Telegram test failed:', error);
        return false;
    }
}
