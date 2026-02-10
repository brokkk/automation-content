/**
 * Batch Content Generator - Generate all content in ONE LLM call
 * Reduces LLM usage from 3+ calls to 1 call per article
 */

import { supabase, type ContentItem, type PlatformConfig } from './supabase.js';
import { sendApprovalNotification } from './telegram.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface BatchGeneratedContent {
    igCaption: string;
    fbCaption: string;
    imageHeadline: string;
    imageSubtext: string;
    imageCta: string;
    hashtags: string[];
}

/**
 * Generate ALL content in a single LLM call
 * Instagram caption + Facebook caption + Image copy = 1 API call
 */
export async function batchGenerateContent(
    article: {
        title: string;
        description?: string;
        url?: string;
        fullText?: string;
    },
    config?: {
        tone?: string;
        language?: string;
        hashtags?: string[];
        igMinLength?: number;
        igMaxLength?: number;
        fbMinLength?: number;
        fbMaxLength?: number;
        customInstructions?: string;
        useEmoji?: boolean;
    }
): Promise<BatchGeneratedContent | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.LLM_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free';

    if (!apiKey) {
        console.error('OPENROUTER_API_KEY not set');
        return null;
    }

    const tone = config?.tone || 'informative';
    const language = config?.language || 'Indonesian';
    const defaultHashtags = config?.hashtags || [];
    const igMin = config?.igMinLength || 400;
    const igMax = config?.igMaxLength || 500;
    const fbMin = config?.fbMinLength || 600;
    const fbMax = config?.fbMaxLength || 800;
    const customInstructions = config?.customInstructions || '';
    const useEmoji = config?.useEmoji ?? true;

    // Tone-specific system prompts
    const tonePrompts: Record<string, string> = {
        casual: `Kamu adalah content creator Gen-Z yang gaul dan relatable.
Gaya bahasa: santai, friendly, banyak slang Indonesia (kayak, banget, sih, dong, nih).
Gunakan emoji secara natural (3-4 emoji per caption).
Buat pembaca merasa seperti ngobrol sama temen.
Hindari bahasa kaku atau formal.`,

        professional: `Kamu adalah social media manager profesional untuk brand premium.
Gaya bahasa: elegan, terpercaya, informatif tapi tidak kaku.
Gunakan bahasa baku Indonesia yang baik.
Fokus pada value dan insight, bukan hype.
Emoji minimal (1-2 saja) dan profesional.`,

        humorous: `Kamu adalah comedian yang jago bikin konten viral.
Gaya bahasa: lucu, witty, banyak wordplay dan punchline.
Selalu cari angle yang unexpected atau ironis.
Gunakan emoji yang support joke (😂🤣💀).
Bikin pembaca ketawa tapi tetap dapat informasi.`,

        informative: `Kamu adalah jurnalis lifestyle yang informatif dan engaging.
Gaya bahasa: edukatif, detail, berbobot tapi mudah dicerna.
Selalu highlight fakta menarik dan insight baru.
Struktur clear: hook → info utama → takeaway.
Gunakan emoji untuk highlight poin penting.`,

        inspirational: `Kamu adalah motivator yang positif dan uplifting.
Gaya bahasa: inspiring, empowering, penuh semangat.
Fokus pada peluang, potensi, dan hal positif.
Gunakan kata-kata yang membangkitkan semangat.
Emoji yang positive vibes (✨🔥💪🚀).`,
    };

    const tonePrompt = tonePrompts[tone] || tonePrompts.informative;

    const systemPrompt = `${tonePrompt}

CRITICAL: Semua output HARUS dalam Bahasa Indonesia. JANGAN gunakan bahasa Inggris.
${customInstructions ? `\nINSTRUKSI TAMBAHAN: ${customInstructions}` : ''}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation. Just the JSON object.`;

    const userPrompt = `Buat konten social media untuk artikel ini:

JUDUL: ${article.title}
${article.description ? `RINGKASAN: ${article.description}` : ''}
${article.fullText ? `ISI LENGKAP ARTIKEL:\n${article.fullText.substring(0, 2000)}` : ''}

PENTING: 
- Semua output HARUS dalam Bahasa Indonesia, JANGAN gunakan bahasa Inggris
- Caption harus INFORMATIF dan berisi poin-poin penting dari artikel
- Jangan hanya promosi, tapi berikan VALUE kepada pembaca
- JANGAN gunakan format markdown seperti **, *, ##, atau bullet points
- Tulis sebagai paragraf mengalir yang mudah dibaca
${!useEmoji ? '- JANGAN gunakan emoji sama sekali' : ''}

Generate JSON dengan struktur ini:
{
  "igCaption": "Caption Instagram dalam Bahasa Indonesia (${igMin}-${igMax} karakter). Tulis sebagai paragraf yang mengalir dengan hook menarik di awal, poin-poin penting dari artikel, dan ajakan untuk diskusi di akhir.${useEmoji ? ' Gunakan 2-3 emoji yang relevan.' : ' TANPA emoji.'}",
  "fbCaption": "Caption Facebook dalam Bahasa Indonesia (${fbMin}-${fbMax} karakter). Tulis sebagai paragraf panjang dengan opening engaging, ringkasan artikel, dan pertanyaan di akhir.${useEmoji ? '' : ' TANPA emoji.'}",
  "imageHeadline": "Headline bold untuk gambar dalam Bahasa Indonesia (max 8 kata)",
  "imageSubtext": "Teks pendukung singkat untuk gambar dalam Bahasa Indonesia (MAKSIMAL 100 karakter, 1-2 kalimat pendek yang melengkapi headline)",
  "imageCta": "Call to action singkat dalam Bahasa Indonesia",
  "hashtags": [${defaultHashtags.length > 0 ? '"hashtag1", "hashtag2", "hashtag3"' : ''}]
}
${defaultHashtags.length > 0 ? `Gunakan hashtag dasar: ${defaultHashtags.join(', ')}` : 'JANGAN generate hashtags apapun, biarkan array hashtags KOSONG []'}
Kembalikan HANYA JSON object, tidak ada yang lain.`;

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://homeless-media.com',
                'X-Title': 'Homeless Media Content Pipeline',
            },
            body: JSON.stringify({
                model,
                messages: [
                    // Some models don't support system messages, so we include context in user message
                    { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
                ],
                temperature: 0.7,
                max_tokens: 800,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Batch generation error:', error);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Debug: show raw response
        console.log('  📝 Raw LLM response length:', content.length);

        // Try multiple JSON extraction methods
        let jsonStr = '';

        // Method 1: Look for JSON in code block
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }

        // Method 2: Look for raw JSON object
        if (!jsonStr) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
        }

        if (!jsonStr) {
            console.error('  ❌ Could not find JSON in response');
            console.error('  Response preview:', content.substring(0, 200));
            return null;
        }

        try {
            const parsed = JSON.parse(jsonStr) as BatchGeneratedContent;

            // Strip HTML tags from all text fields (LLM sometimes adds <b>, <i>, etc.)
            const stripHtml = (str: string) => str?.replace(/<[^>]*>/g, '').trim() || '';

            parsed.igCaption = stripHtml(parsed.igCaption);
            parsed.fbCaption = stripHtml(parsed.fbCaption);
            parsed.imageHeadline = stripHtml(parsed.imageHeadline);
            parsed.imageSubtext = stripHtml(parsed.imageSubtext || '').substring(0, 100);
            parsed.imageCta = stripHtml(parsed.imageCta || '');

            // Validate required fields
            if (!parsed.igCaption || !parsed.fbCaption || !parsed.imageHeadline) {
                console.error('  ❌ Missing required fields in batch content');
                return null;
            }

            // Ensure hashtags is array (empty is valid)
            if (!Array.isArray(parsed.hashtags)) {
                parsed.hashtags = [];
            }

            return parsed;
        } catch (parseError) {
            console.error('  ❌ JSON parse error:', parseError);
            console.error('  JSON string:', jsonStr.substring(0, 200));
            return null;
        }
    } catch (error) {
        console.error('Batch generation failed:', error);
        return null;
    }
}

/**
 * Process a single article with batch generation (1 LLM call total)
 */
export async function processArticleOptimized(
    item: ContentItem,
    options: { skipScoring?: boolean } = {}
): Promise<boolean> {
    console.log(`\n🤖 Processing: ${item.original_title?.substring(0, 50)}...`);

    // Get platform config
    const { data: config } = await supabase
        .from('platform_configs')
        .select('*')
        .eq('platform', 'instagram')
        .eq('is_active', true)
        .single();

    // Scrape full article content for better captions AND images
    let fullArticleText: string | undefined;
    let scrapedImageUrl: string | null = null;

    if (item.original_url) {
        console.log('  📄 Scraping full article content...');
        const { scrapeArticleContent } = await import('./image-scraper.js');
        const scraped = await scrapeArticleContent(item.original_url);
        fullArticleText = scraped.articleText || undefined;
        scrapedImageUrl = scraped.imageUrl;

        // ALWAYS prefer scraped og:image over RSS image
        // RSS feeds almost always provide low-res thumbnails, og:image is full resolution
        if (scrapedImageUrl && scrapedImageUrl !== item.original_image) {
            console.log('  🔄 Using scraped og:image (higher quality) instead of RSS image');
            await supabase
                .from('content_items')
                .update({ original_image: scrapedImageUrl })
                .eq('id', item.id);
            item.original_image = scrapedImageUrl;
        }
    }

    // Get platform config from database (from PlatformSettingsPage)
    const { data: platformConfig } = await supabase
        .from('platform_configs')
        .select('*')
        .eq('platform', 'instagram')
        .eq('is_active', true)
        .single();

    // Parse hashtags from string format - respect empty setting (no fallback)
    const hashtagsArray = platformConfig?.hashtags
        ? platformConfig.hashtags.split(/[#\s]+/).filter((h: string) => h.length > 0)
        : [];

    // Batch generate all content in ONE call
    console.log('  ✍️ Batch generating content (1 LLM call)...');
    const content = await batchGenerateContent(
        {
            title: item.original_title || '',
            description: item.original_desc || undefined,
            url: item.original_url || undefined,
            fullText: fullArticleText,
        },
        {
            tone: platformConfig?.tone || 'informative',
            language: platformConfig?.language === 'id' ? 'Indonesian' : 'English',
            hashtags: hashtagsArray,
            // Caption length based on setting: short (200), medium (400), long (800)
            igMinLength: Math.floor((platformConfig?.max_length || 400) * 0.8),
            igMaxLength: platformConfig?.max_length || 400,
            fbMinLength: Math.floor((platformConfig?.max_length || 400) * 1.2),
            fbMaxLength: Math.floor((platformConfig?.max_length || 400) * 1.5),
            customInstructions: platformConfig?.cta_template || '',
            useEmoji: platformConfig?.use_emoji ?? true,
        }
    );

    if (!content) {
        console.error('  ❌ Failed to generate content');
        return false;
    }

    // Build full captions with hashtags (only if hashtags exist)
    const hashtagString = content.hashtags.length > 0
        ? content.hashtags.map(h => `#${h}`).join(' ')
        : '';
    const igCaptionFull = hashtagString
        ? `${content.igCaption}\n\n${hashtagString}`
        : content.igCaption;
    const fbCaptionFull = content.fbCaption;

    // Update database
    const { error } = await supabase
        .from('content_items')
        .update({
            ig_caption: igCaptionFull,
            fb_caption: fbCaptionFull,
            headline: content.imageHeadline,
            subheadline: content.imageSubtext,
            image_headline: content.imageHeadline,
            image_subtext: content.imageSubtext,
            image_cta: content.imageCta,
            status: 'ai_generated',
            updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

    if (error) {
        console.error('  ❌ Database update error:', error.message);
        return false;
    }

    // Generate image using template
    console.log('  🎨 Generating image...');
    try {
        const { generateImage } = await import('./image-generator.js');
        const { scrapeArticleImage } = await import('./image-scraper.js');

        // Get category name if available
        let categoryName = 'Lifestyle';
        if (item.source?.category_id) {
            const { data: cat } = await supabase
                .from('categories')
                .select('name')
                .eq('id', item.source.category_id)
                .single();
            if (cat) categoryName = cat.name;
        }

        // Get image - use original or scrape from article
        let articleImage = item.original_image;
        if (!articleImage && item.original_url) {
            console.log('  🔍 No image in RSS, scraping from article...');
            articleImage = await scrapeArticleImage(item.original_url);

            // Save scraped image to DB for future use
            if (articleImage) {
                await supabase
                    .from('content_items')
                    .update({ original_image: articleImage })
                    .eq('id', item.id);
            }
        }

        const imageBuffer = await generateImage('instagram-post', {
            headline: content.imageHeadline,
            subheadline: content.imageSubtext,
            category: categoryName,
            imageUrl: articleImage || undefined,
            brandHandle: '@lifestylemedia',
        });

        // Upload to Supabase Storage for public URL (required for Instagram API)
        const fileName = `content-images/${item.id}-${Date.now()}.png`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('generated-images')
            .upload(fileName, imageBuffer, {
                contentType: 'image/png',
                upsert: true,
            });

        if (uploadError) {
            console.log('  ⚠️ Storage upload failed:', uploadError.message);
            // Fallback to base64
            const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            await supabase
                .from('content_items')
                .update({ generated_image: imageBase64 })
                .eq('id', item.id);
        } else {
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('generated-images')
                .getPublicUrl(fileName);

            const publicUrl = urlData.publicUrl;
            console.log('  📤 Image uploaded:', publicUrl.substring(0, 60) + '...');

            // Save URL for Instagram posting
            await supabase
                .from('content_items')
                .update({
                    generated_image_url: publicUrl,
                    generated_image: `data:image/png;base64,${imageBuffer.toString('base64').substring(0, 100)}...` // Truncated for preview
                })
                .eq('id', item.id);
        }

        console.log('  ✅ Image generated and saved!');
    } catch (imgError) {
        console.log('  ⚠️ Image generation skipped:', (imgError as Error).message);
    }

    console.log('  ✅ Content generated and saved!');
    console.log(`     📱 IG: "${content.igCaption.substring(0, 50)}..."`);
    console.log(`     📘 FB: "${content.fbCaption.substring(0, 50)}..."`);
    console.log(`     🖼️ Headline: "${content.imageHeadline}"`);

    // Send Telegram notification
    try {
        console.log('  📱 Sending Telegram notification...');
        const sent = await sendApprovalNotification({
            ...item,
            ig_caption: igCaptionFull,
            fb_caption: fbCaptionFull,
            headline: content.imageHeadline,
            subheadline: content.imageSubtext,
            image_headline: content.imageHeadline,
            image_subtext: content.imageSubtext,
            image_cta: content.imageCta,
        });
        console.log('  📱 Telegram notification:', sent ? 'SENT ✅' : 'NOT SENT (check settings)');
    } catch (e) {
        console.log('  ⚠️ Telegram notification error:', (e as Error).message);
    }

    return true;
}

/**
 * Process multiple articles efficiently
 * Uses only 1 LLM call per article (no separate scoring)
 */
export async function processArticlesOptimized(
    items: ContentItem[],
    options: { maxItems?: number } = {}
): Promise<number> {
    const maxItems = options.maxItems || 5;
    const toProcess = items.slice(0, maxItems);

    console.log(`\n🚀 Processing ${toProcess.length} articles (${toProcess.length} LLM calls total)...`);

    let processed = 0;
    for (const item of toProcess) {
        const success = await processArticleOptimized(item, { skipScoring: true });
        if (success) processed++;

        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n✅ Processed ${processed}/${toProcess.length} articles`);
    return processed;
}
