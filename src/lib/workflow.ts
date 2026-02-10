import { supabase } from './supabase';
import { generateContent } from './llm';
import { createApprovalRequest } from './approval';
import type { Database } from './database.types';

type ContentItemInsert = Database['public']['Tables']['content_items']['Insert'];

// ============================================
// RSS Processing Workflow
// ============================================

interface RssItem {
    title: string;
    description?: string;
    link: string;
    guid?: string;
    pubDate?: string;
    image?: string;
    sourceId?: string;  // Optional for manual tests
    categoryId?: string;
}

/**
 * Process incoming RSS item - called by n8n webhook
 */
export async function processRssItem(item: RssItem): Promise<{
    success: boolean;
    contentId?: string;
    error?: string;
}> {
    try {
        // Check if already processed (by guid)
        if (item.guid) {
            const { data: existing } = await supabase
                .from('content_items')
                .select('id')
                .eq('guid', item.guid)
                .single();

            if (existing) {
                return { success: true, contentId: existing.id };
            }
        }

        // Create content item in 'incoming' status
        const contentItem: ContentItemInsert = {
            source_id: item.sourceId || null,  // Handle optional sourceId
            category_id: item.categoryId || null,
            original_title: item.title,
            original_desc: item.description || null,
            original_url: item.link,
            original_image: item.image || null,
            guid: item.guid || null,
            status: 'incoming',
            platform: 'both',
        };

        const { data: content, error } = await supabase
            .from('content_items')
            .insert(contentItem)
            .select()
            .single();

        if (error || !content) {
            throw new Error(error?.message || 'Failed to create content');
        }

        return { success: true, contentId: content.id };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

/**
 * Generate AI content for an item - called by n8n after RSS processing
 */
export async function generateAiContent(contentId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        // Get content item
        const { data: content, error: fetchError } = await supabase
            .from('content_items')
            .select('*, category:categories(*)')
            .eq('id', contentId)
            .single();

        if (fetchError || !content) {
            throw new Error('Content not found');
        }

        // Generate content using LLM
        const generated = await generateContent({
            title: content.original_title,
            description: content.original_desc || undefined,
            url: content.original_url,
            category: content.category?.name,
        });

        if (!generated) {
            throw new Error('LLM generation failed');
        }

        // Update content with generated data
        const { error: updateError } = await supabase
            .from('content_items')
            .update({
                headline: generated.headline,
                subheadline: generated.subheadline,
                ig_caption: generated.igCaption,
                fb_caption: generated.fbCaption,
                ai_confidence: generated.confidence || 0.85,
                status: 'ai_generated',
                updated_at: new Date().toISOString(),
            })
            .eq('id', contentId);

        if (updateError) {
            throw new Error(updateError.message);
        }

        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

/**
 * Send content for approval - creates token and can trigger notification
 */
export async function sendForApproval(contentId: string): Promise<{
    success: boolean;
    approvalUrl?: string;
    error?: string;
}> {
    try {
        const { token, approvalUrl } = await createApprovalRequest(contentId, 48);

        // Log the approval request
        await supabase.from('system_events').insert({
            event_type: 'APPROVAL_REQUESTED',
            severity: 'INFO',
            source: 'workflow',
            message: `Approval requested for content ${contentId}`,
            metadata: { contentId, approvalUrl },
        });

        return { success: true, approvalUrl };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

// ============================================
// Publishing Workflow
// ============================================

interface PublishResult {
    success: boolean;
    platform: 'instagram' | 'facebook';
    externalId?: string;
    error?: string;
}

/**
 * Publish content to Buffer (or directly to platforms)
 */
export async function publishContent(contentId: string): Promise<{
    success: boolean;
    results: PublishResult[];
    error?: string;
}> {
    try {
        // Get approved content
        const { data: content, error: fetchError } = await supabase
            .from('content_items')
            .select('*')
            .eq('id', contentId)
            .eq('status', 'approved')
            .single();

        if (fetchError || !content) {
            throw new Error('Approved content not found');
        }

        const results: PublishResult[] = [];

        // This is where you'd integrate with Buffer API or Meta Graph API
        // For now, we'll simulate successful publishing

        if (content.platform === 'both' || content.platform === 'instagram') {
            results.push({
                success: true,
                platform: 'instagram',
                externalId: `ig_${Date.now()}`,
            });
        }

        if (content.platform === 'both' || content.platform === 'facebook') {
            results.push({
                success: true,
                platform: 'facebook',
                externalId: `fb_${Date.now()}`,
            });
        }

        // Log publish results
        for (const result of results) {
            await supabase.from('publish_logs').insert({
                content_id: contentId,
                platform: result.platform,
                external_id: result.externalId,
                status: result.success ? 'success' : 'failed',
                published_at: new Date().toISOString(),
            });
        }

        // Update content status
        const allSuccess = results.every(r => r.success);
        await supabase
            .from('content_items')
            .update({
                status: allSuccess ? 'published' : 'failed',
                published_at: allSuccess ? new Date().toISOString() : null,
            })
            .eq('id', contentId);

        return { success: allSuccess, results };
    } catch (err) {
        return {
            success: false,
            results: [],
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

// ============================================
// Full Pipeline (for testing without n8n)
// ============================================

/**
 * Process entire pipeline for a single RSS item
 */
export async function runFullPipeline(item: RssItem): Promise<{
    success: boolean;
    contentId?: string;
    approvalUrl?: string;
    error?: string;
}> {
    // Step 1: Process RSS
    const rssResult = await processRssItem(item);
    if (!rssResult.success || !rssResult.contentId) {
        return { success: false, error: rssResult.error || 'RSS processing failed' };
    }

    // Step 2: Generate AI content
    const aiResult = await generateAiContent(rssResult.contentId);
    if (!aiResult.success) {
        return { success: false, contentId: rssResult.contentId, error: aiResult.error };
    }

    // Step 3: Send for approval
    const approvalResult = await sendForApproval(rssResult.contentId);

    return {
        success: approvalResult.success,
        contentId: rssResult.contentId,
        approvalUrl: approvalResult.approvalUrl,
        error: approvalResult.error,
    };
}
