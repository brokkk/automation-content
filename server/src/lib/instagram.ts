import { supabase } from './supabase.js';

// ============================================
// Instagram Graph API Integration
// ============================================

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';

interface InstagramPostResult {
    success: boolean;
    postId?: string;
    error?: string;
}

/**
 * Get Instagram credentials from database or env
 */
async function getInstagramCredentials(): Promise<{
    accessToken: string | null;
    igAccountId: string | null;
}> {
    // Try from app_settings first
    const { data: tokenData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'instagram_access_token')
        .single();

    const { data: accountData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'instagram_account_id')
        .single();

    return {
        accessToken: tokenData?.value || process.env.INSTAGRAM_ACCESS_TOKEN || null,
        igAccountId: accountData?.value || process.env.INSTAGRAM_ACCOUNT_ID || null,
    };
}

/**
 * Create media container (step 1 of Instagram posting)
 */
async function createMediaContainer(
    igAccountId: string,
    accessToken: string,
    imageUrl: string,
    caption: string
): Promise<{ success: boolean; containerId?: string; error?: string }> {
    try {
        const params = new URLSearchParams({
            image_url: imageUrl,
            caption: caption,
            access_token: accessToken,
        });

        const response = await fetch(
            `${GRAPH_API_URL}/${igAccountId}/media?${params}`,
            { method: 'POST' }
        );

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return { success: true, containerId: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Publish media container (step 2 of Instagram posting)
 */
async function publishMediaContainer(
    igAccountId: string,
    accessToken: string,
    containerId: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
        const params = new URLSearchParams({
            creation_id: containerId,
            access_token: accessToken,
        });

        const response = await fetch(
            `${GRAPH_API_URL}/${igAccountId}/media_publish?${params}`,
            { method: 'POST' }
        );

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return { success: true, postId: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Post to Instagram (main function)
 */
export async function postToInstagram(
    imageUrl: string,
    caption: string
): Promise<InstagramPostResult> {
    console.log('📸 Posting to Instagram...');

    const { accessToken, igAccountId } = await getInstagramCredentials();

    if (!accessToken || !igAccountId) {
        console.log('  ❌ Instagram credentials not configured');
        return { success: false, error: 'Instagram credentials not configured' };
    }

    // Step 1: Create media container
    console.log('  📦 Creating media container...');
    const containerResult = await createMediaContainer(
        igAccountId,
        accessToken,
        imageUrl,
        caption
    );

    if (!containerResult.success) {
        console.log(`  ❌ Container creation failed: ${containerResult.error}`);
        return { success: false, error: containerResult.error };
    }

    // Wait a moment for Instagram to process the image
    console.log('  ⏳ Waiting for image processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Publish the container
    console.log('  📤 Publishing post...');
    const publishResult = await publishMediaContainer(
        igAccountId,
        accessToken,
        containerResult.containerId!
    );

    if (!publishResult.success) {
        console.log(`  ❌ Publish failed: ${publishResult.error}`);
        return { success: false, error: publishResult.error };
    }

    console.log(`  ✅ Posted successfully! ID: ${publishResult.postId}`);
    return { success: true, postId: publishResult.postId };
}

/**
 * Publish content item to Instagram
 */
export async function publishContentToInstagram(contentId: string): Promise<InstagramPostResult> {
    console.log(`📤 Publishing content ${contentId} to Instagram...`);

    // Get content from database
    const { data: content, error: contentError } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', contentId)
        .single();

    if (contentError || !content) {
        console.error('Content not found:', contentError?.message);
        return { success: false, error: 'Content not found' };
    }

    // Need an image URL — prefer template image with headline overlay
    let imageUrl = content.generated_image_url;

    // Auto-generate template image if not available
    if (!imageUrl) {
        console.log('  🎨 No template image, generating before posting...');
        try {
            // Scrape high-res og:image
            let bgImageUrl = content.original_image;
            if (content.original_url) {
                const { scrapeArticleImage } = await import('./image-scraper.js');
                const scraped = await scrapeArticleImage(content.original_url);
                if (scraped) {
                    bgImageUrl = scraped;
                    console.log('  🔍 Using scraped og:image (high-res)');
                }
            }

            const { generateImage, closeBrowser } = await import('./image-generator.js');
            const imageBuffer = await generateImage('instagram-post', {
                headline: content.headline || content.original_title || 'Untitled',
                subheadline: content.subheadline || content.image_subtext || '',
                category: 'News',
                imageUrl: bgImageUrl || undefined,
                brandHandle: '@lifestylemedia',
            });

            const fileName = `content-images/${contentId}-publish-${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
                .from('generated-images')
                .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

            if (!uploadError) {
                const { data: urlData } = supabase.storage
                    .from('generated-images')
                    .getPublicUrl(fileName);
                imageUrl = urlData.publicUrl;

                await supabase
                    .from('content_items')
                    .update({ generated_image_url: imageUrl })
                    .eq('id', contentId);

                console.log('  📤 Template image ready:', imageUrl.substring(0, 60) + '...');
            }
            await closeBrowser();
        } catch (e) {
            console.error('  ⚠️ Template generation failed, using original image');
            imageUrl = content.original_image;
        }
    }

    if (!imageUrl) {
        return { success: false, error: 'No image available for posting' };
    }

    // Post to Instagram
    const result = await postToInstagram(imageUrl, content.ig_caption || content.headline || '');

    // Log to database
    await supabase.from('publish_logs').insert({
        content_id: content.id,
        platform: 'instagram',
        external_id: result.postId,
        status: result.success ? 'success' : 'failed',
        error_message: result.error,
        published_at: result.success ? new Date().toISOString() : null,
    });

    // Update content status
    if (result.success) {
        await supabase
            .from('content_items')
            .update({
                status: 'published',
                published_at: new Date().toISOString(),
            })
            .eq('id', content.id);
    }

    return result;
}
