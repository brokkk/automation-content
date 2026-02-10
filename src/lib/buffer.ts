import { supabase } from './supabase';
import type { Database } from './database.types';

type ContentItem = Database['public']['Tables']['content_items']['Row'];

// ============================================
// Buffer API Integration
// ============================================

const BUFFER_API_URL = 'https://api.bufferapp.com/1';

interface BufferProfile {
    id: string;
    service: 'instagram' | 'facebook' | 'twitter' | 'linkedin';
    formatted_username: string;
    avatar: string;
}

interface BufferCreateOptions {
    text: string;
    profile_ids: string[];
    media?: {
        photo?: string;
    };
    scheduled_at?: number; // Unix timestamp
    now?: boolean;
}

/**
 * Get Buffer access token from settings
 */
async function getBufferToken(): Promise<string | null> {
    const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'buffer_access_token')
        .single();

    return data?.value || import.meta.env.VITE_BUFFER_ACCESS_TOKEN || null;
}

/**
 * Get all connected Buffer profiles
 */
export async function getBufferProfiles(): Promise<BufferProfile[]> {
    const token = await getBufferToken();
    if (!token) return [];

    try {
        const response = await fetch(`${BUFFER_API_URL}/profiles.json?access_token=${token}`);
        if (!response.ok) throw new Error('Failed to fetch profiles');
        return await response.json();
    } catch (error) {
        console.error('Buffer profiles error:', error);
        return [];
    }
}

/**
 * Create a Buffer post
 */
export async function createBufferPost(options: BufferCreateOptions): Promise<{
    success: boolean;
    updateId?: string;
    error?: string;
}> {
    const token = await getBufferToken();
    if (!token) {
        return { success: false, error: 'Buffer access token not configured' };
    }

    try {
        const formData = new URLSearchParams();
        formData.append('access_token', token);
        formData.append('text', options.text);

        options.profile_ids.forEach(id => {
            formData.append('profile_ids[]', id);
        });

        if (options.media?.photo) {
            formData.append('media[photo]', options.media.photo);
        }

        if (options.scheduled_at) {
            formData.append('scheduled_at', options.scheduled_at.toString());
        }

        if (options.now) {
            formData.append('now', 'true');
        }

        const response = await fetch(`${BUFFER_API_URL}/updates/create.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return { success: false, error: data.message || 'Failed to create post' };
        }

        return { success: true, updateId: data.updates?.[0]?.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Publish content to social media via Buffer
 */
export async function publishToBuffer(
    content: ContentItem,
    imageUrl?: string,
    scheduleTime?: Date
): Promise<{
    success: boolean;
    results: { platform: string; success: boolean; updateId?: string; error?: string }[];
}> {
    const profiles = await getBufferProfiles();
    const results: { platform: string; success: boolean; updateId?: string; error?: string }[] = [];

    // Filter by platform
    const igProfile = profiles.find(p => p.service === 'instagram');
    const fbProfile = profiles.find(p => p.service === 'facebook');

    const targetProfiles: BufferProfile[] = [];

    if ((content.platform === 'both' || content.platform === 'instagram') && igProfile) {
        targetProfiles.push(igProfile);
    }
    if ((content.platform === 'both' || content.platform === 'facebook') && fbProfile) {
        targetProfiles.push(fbProfile);
    }

    if (targetProfiles.length === 0) {
        return { success: false, results: [{ platform: 'all', success: false, error: 'No matching profiles found' }] };
    }

    // Create posts for each profile
    for (const profile of targetProfiles) {
        const caption = profile.service === 'instagram'
            ? content.ig_caption
            : content.fb_caption;

        const result = await createBufferPost({
            text: caption || content.headline || '',
            profile_ids: [profile.id],
            media: imageUrl ? { photo: imageUrl } : undefined,
            scheduled_at: scheduleTime ? Math.floor(scheduleTime.getTime() / 1000) : undefined,
            now: !scheduleTime,
        });

        results.push({
            platform: profile.service,
            success: result.success,
            updateId: result.updateId,
            error: result.error,
        });

        // Log to database
        await supabase.from('publish_logs').insert({
            content_id: content.id,
            platform: profile.service,
            external_id: result.updateId,
            status: result.success ? 'success' : 'failed',
            error_message: result.error,
            published_at: result.success ? new Date().toISOString() : null,
        });
    }

    const allSuccess = results.every(r => r.success);

    // Update content status
    if (allSuccess) {
        await supabase
            .from('content_items')
            .update({
                status: scheduleTime ? 'scheduled' : 'published',
                published_at: scheduleTime ? null : new Date().toISOString(),
                scheduled_at: scheduleTime?.toISOString(),
            })
            .eq('id', content.id);
    }

    return { success: allSuccess, results };
}

/**
 * Get pending scheduled posts
 */
export async function getPendingUpdates(): Promise<unknown[]> {
    const token = await getBufferToken();
    if (!token) return [];

    const profiles = await getBufferProfiles();
    const allUpdates: unknown[] = [];

    for (const profile of profiles) {
        try {
            const response = await fetch(
                `${BUFFER_API_URL}/profiles/${profile.id}/updates/pending.json?access_token=${token}`
            );
            if (response.ok) {
                const data = await response.json();
                allUpdates.push(...(data.updates || []));
            }
        } catch (error) {
            console.error(`Failed to fetch updates for ${profile.id}:`, error);
        }
    }

    return allUpdates;
}
