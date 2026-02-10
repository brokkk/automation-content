import { supabase } from './supabase.js';

// ============================================
// Buffer API Integration (Server-side)
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
    scheduled_at?: number;
    now?: boolean;
}

/**
 * Get Buffer access token from database or env
 */
async function getBufferToken(): Promise<string | null> {
    const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'buffer_access_token')
        .single();

    return data?.value || process.env.BUFFER_ACCESS_TOKEN || null;
}

/**
 * Get all connected Buffer profiles
 */
export async function getBufferProfiles(): Promise<BufferProfile[]> {
    const token = await getBufferToken();
    if (!token) {
        console.log('Buffer: No access token configured');
        return [];
    }

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
export async function publishToBuffer(contentId: string): Promise<{
    success: boolean;
    results: { platform: string; success: boolean; updateId?: string; error?: string }[];
}> {
    console.log(`📤 Publishing content ${contentId} to Buffer...`);

    // Get content from database
    const { data: content, error: contentError } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', contentId)
        .single();

    if (contentError || !content) {
        console.error('Content not found:', contentError?.message);
        return { success: false, results: [{ platform: 'all', success: false, error: 'Content not found' }] };
    }

    const profiles = await getBufferProfiles();
    const results: { platform: string; success: boolean; updateId?: string; error?: string }[] = [];

    if (profiles.length === 0) {
        console.log('Buffer: No profiles connected');
        return { success: false, results: [{ platform: 'all', success: false, error: 'No Buffer profiles connected' }] };
    }

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

        console.log(`  📱 Posting to ${profile.service}: ${profile.formatted_username}`);

        const result = await createBufferPost({
            text: caption || content.headline || '',
            profile_ids: [profile.id],
            media: content.generated_image_url ? { photo: content.generated_image_url } : undefined,
            now: true,
        });

        results.push({
            platform: profile.service,
            success: result.success,
            updateId: result.updateId,
            error: result.error,
        });

        console.log(`  ${result.success ? '✅' : '❌'} ${profile.service}: ${result.success ? 'Posted' : result.error}`);

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
                status: 'published',
                published_at: new Date().toISOString(),
            })
            .eq('id', content.id);
        console.log('  ✅ Content marked as published');
    }

    return { success: allSuccess, results };
}
