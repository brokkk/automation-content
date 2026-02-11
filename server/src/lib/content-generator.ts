import { supabase, type ContentItem, type PlatformConfig } from './supabase.js';
import { sendApprovalNotification } from './telegram.js';
import { scoreArticle, type ScoringResult } from './article-scorer.js';
import { scrapeArticle } from './article-scraper.js';

// ============================================
// Enhanced Content Generator with Full AI Automation
// ============================================

// Get platform config for Instagram
async function getInstagramConfig(): Promise<PlatformConfig | null> {
    const { data, error } = await supabase
        .from('platform_configs')
        .select('*')
        .eq('platform', 'instagram')
        .eq('is_active', true)
        .single();

    if (error) {
        console.error('Error fetching Instagram config:', error);
        return null;
    }

    return data;
}

// Get automation settings
async function getAutomationSettings(): Promise<{
    minScoreThreshold: number;
    maxArticlesPerCrawl: number;
}> {
    const { data } = await supabase
        .from('automation_settings')
        .select('setting_key, setting_value');

    const settings = {
        minScoreThreshold: 60,
        maxArticlesPerCrawl: 5,
    };

    if (data) {
        for (const row of data) {
            if (row.setting_key === 'min_score_threshold') {
                settings.minScoreThreshold = parseInt(row.setting_value) || 60;
            }
            if (row.setting_key === 'max_articles_per_crawl') {
                settings.maxArticlesPerCrawl = parseInt(row.setting_value) || 5;
            }
        }
    }

    return settings;
}

// Generate content using OpenRouter
async function generateWithOpenRouter(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7
): Promise<string | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.LLM_MODEL || 'google/gemma-2-9b-it:free';

    if (!apiKey) {
        console.error('OpenRouter API key not configured');
        return null;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
                'X-Title': 'AI Content Pipeline',
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature,
                max_tokens: 2000,
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('OpenRouter error:', data.error);
            return null;
        }

        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error('OpenRouter generation failed:', error);
        return null;
    }
}

// ============================================
// ENHANCED: Full Content Generation
// ============================================

interface GeneratedContent {
    headline: string;
    igCaption: string;
    fbCaption: string;
    imageHeadline: string;   // Text for image (max 8 words)
    imageSubtext: string;    // Supporting text for image
    imageCta: string;        // CTA for image
    confidence: number;
}

const FULL_CONTENT_SYSTEM_PROMPT = `You are an expert social media content creator. Create viral-worthy content from the article provided.

Output ONLY valid JSON in this exact format:
{
  "headline": "Catchy headline (max 60 chars)",
  "igCaption": "Full Instagram caption with emojis and line breaks. MUST have 2-3 paragraphs separated by empty lines. Paragraph 1: engaging hook. Paragraph 2: key points. Paragraph 3: call to discussion. Include 5-10 hashtags at the end (max 2000 chars)",
  "fbCaption": "Conversational Facebook caption (max 500 chars)",
  "imageHeadline": "BOLD text for image overlay (max 8 words, impactful)",
  "imageSubtext": "Supporting text for image (MAXIMUM 100 characters, 1-2 short sentences)",
  "imageCta": "Call to action for image (e.g., 'Swipe to learn more')",
  "confidence": 0.85
}

Guidelines:
- Headlines should be punchy and attention-grabbing
- Instagram captions should use strategic emojis
- Image text should be SHORT and IMPACTFUL (think meme-style)
- Make content that people will want to share
- Be culturally relevant and engaging`;

async function generateFullContent(
    article: {
        title: string;
        fullText?: string;
        description?: string;
        url: string;
    },
    config: PlatformConfig
): Promise<GeneratedContent | null> {
    const userPrompt = `Create viral social media content for this article:

TITLE: ${article.title}

${article.fullText ? `FULL ARTICLE:\n${article.fullText.substring(0, 3000)}` : ''}
${article.description ? `DESCRIPTION: ${article.description}` : ''}

URL: ${article.url}

PLATFORM SETTINGS:
- Tone: ${config.tone}
- Language: ${config.language === 'id' ? 'Indonesian' : 'English'}
- Use Emojis: ${config.use_emoji ? 'Yes' : 'No'}
- Hashtags to include: ${config.hashtags || 'Generate relevant ones'}

Generate engaging content that will maximize engagement.`;

    const response = await generateWithOpenRouter(FULL_CONTENT_SYSTEM_PROMPT, userPrompt);

    if (!response) return null;

    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]) as GeneratedContent;

        // Add CTA to captions if configured
        if (config.cta_template) {
            parsed.igCaption += `\n\n${config.cta_template}`;
        }

        return parsed;
    } catch {
        console.error('Failed to parse generated content');
        return null;
    }
}

// ============================================
// MAIN: Generate Content for Item (Enhanced)
// ============================================

export async function generateContentForItem(
    item: ContentItem,
    options: { useFullArticle?: boolean } = {}
): Promise<boolean> {
    console.log(`\n🤖 Generating content for: ${item.original_title?.substring(0, 50)}...`);

    const config = await getInstagramConfig();
    if (!config) {
        console.error('Instagram config not found');
        return false;
    }

    // Step 1: Scrape full article if enabled
    let fullText: string | undefined;
    if (options.useFullArticle && item.original_url) {
        console.log('  📄 Scraping full article...');
        const scraped = await scrapeArticle(item.original_url);
        if (scraped) {
            fullText = scraped.content;

            // Save full text to database
            await supabase
                .from('content_items')
                .update({ full_article_text: fullText })
                .eq('id', item.id);
        }
    }

    // Step 2: Generate all content
    console.log('  ✍️ Generating captions and image copy...');
    const generated = await generateFullContent(
        {
            title: item.original_title || '',
            fullText: fullText || (item as any).full_article_text,
            description: item.original_desc || undefined,
            url: item.original_url || '',
        },
        config
    );

    if (!generated) {
        console.error('Failed to generate content');
        return false;
    }

    // Step 3: Update content item with all generated content
    const { error } = await supabase
        .from('content_items')
        .update({
            headline: generated.headline,
            ig_caption: generated.igCaption,
            fb_caption: generated.fbCaption,
            image_headline: generated.imageHeadline,
            image_subtext: generated.imageSubtext,
            image_cta: generated.imageCta,
            ai_confidence: generated.confidence,
            status: 'ai_generated',
            updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

    if (error) {
        console.error('Failed to update content item:', error);
        return false;
    }

    // Step 4: Send Telegram notification
    const updatedItem = {
        ...item,
        headline: generated.headline,
        ig_caption: generated.igCaption,
    };
    await sendApprovalNotification(updatedItem);

    console.log(`  ✅ Content generated successfully!`);
    console.log(`     📱 Image Headline: "${generated.imageHeadline}"`);
    return true;
}

// ============================================
// ENHANCED: Process with AI Scoring & Selection
// ============================================

export async function processIncomingItemsWithScoring(): Promise<number> {
    const settings = await getAutomationSettings();
    const apiKey = process.env.OPENROUTER_API_KEY!;
    const model = process.env.LLM_MODEL || 'google/gemma-2-9b-it:free';

    // Step 1: Get all incoming items
    const { data: items, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('status', 'incoming')
        .order('created_at', { ascending: true })
        .limit(50); // Get more, we'll filter by score

    if (error || !items || items.length === 0) {
        console.log('No incoming items to process');
        return 0;
    }

    console.log(`\n🔍 Found ${items.length} incoming items. Scoring...`);

    // Step 2: Score each article
    const scoredItems: Array<{ item: ContentItem; scoring: ScoringResult }> = [];

    for (const item of items) {
        const scoring = await scoreArticle(
            {
                title: item.original_title || '',
                description: item.original_desc || undefined,
                url: item.original_url || undefined,
            },
            { apiKey, model }
        );

        // Save score to database
        await supabase
            .from('content_items')
            .update({
                ai_score: scoring.score,
                score_breakdown: scoring.breakdown,
            })
            .eq('id', item.id);

        scoredItems.push({ item: item as ContentItem, scoring });

        console.log(`  ${scoring.shouldProcess ? '✅' : '⚪'} [${scoring.score}] ${item.original_title?.substring(0, 50)}...`);

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Step 3: Select top N by score
    const topItems = scoredItems
        .filter(s => s.scoring.score >= settings.minScoreThreshold)
        .sort((a, b) => b.scoring.score - a.scoring.score)
        .slice(0, settings.maxArticlesPerCrawl);

    if (topItems.length === 0) {
        console.log(`\n⚠️ No articles met the score threshold (${settings.minScoreThreshold})`);
        return 0;
    }

    console.log(`\n🏆 Top ${topItems.length} articles selected for generation:\n`);

    // Step 4: Generate content for top articles
    let processed = 0;
    for (const { item, scoring } of topItems) {
        console.log(`Processing [${scoring.score}]: ${item.original_title?.substring(0, 60)}`);

        const success = await generateContentForItem(item, { useFullArticle: true });
        if (success) processed++;

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✅ Generated content for ${processed}/${topItems.length} articles.\n`);
    return processed;
}

// ============================================
// Legacy: Simple Processing (backwards compatible)
// ============================================

export async function processIncomingItems(): Promise<number> {
    // Use the new enhanced processing
    return processIncomingItemsWithScoring();
}

// Regenerate content for a specific item
export async function regenerateContent(itemId: string): Promise<boolean> {
    const { data: item, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', itemId)
        .single();

    if (error || !item) {
        console.error('Item not found:', itemId);
        return false;
    }

    // Reset status and regenerate with full article
    await supabase
        .from('content_items')
        .update({ status: 'incoming' })
        .eq('id', itemId);

    return generateContentForItem(item as ContentItem, { useFullArticle: true });
}
