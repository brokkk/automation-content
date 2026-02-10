/**
 * AI Image Generator — Flux.2 via OpenRouter
 * Generates AI images from article content for Instagram posts.
 * 
 * Flow: Article → LLM generates 2 prompts → Flux generates 2 images
 *       → Template overlay → Upload to Supabase → Telegram selection
 */

import { supabase, type ContentItem } from './supabase.js';
import { sendTelegramMessage } from './telegram.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Generate 2 image prompts from article content using LLM
 * Returns: [photorealistic prompt, artistic prompt]
 */
export async function generateImagePrompts(
    article: {
        headline: string;
        subheadline?: string;
        originalTitle?: string;
        originalDesc?: string;
    }
): Promise<{ promptA: string; promptB: string } | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.LLM_MODEL || 'deepseek/deepseek-v3.2';

    if (!apiKey) {
        console.error('OPENROUTER_API_KEY not set');
        return null;
    }

    const systemPrompt = `You are an expert image prompt engineer. Generate prompts for AI image generation (Flux model).
The image will be used as a background for an Instagram news post. The headline text will be overlaid on top, so:
- Focus on mood, atmosphere, and visual storytelling
- Avoid text, letters, or words in the image
- Create visually striking compositions that work as backgrounds
- Use cinematic lighting and professional photography aesthetics
- Make the image relevant to the article topic

Output ONLY valid JSON, no explanation.`;

    const userPrompt = `Article headline: "${article.headline}"
${article.subheadline ? `Subheadline: "${article.subheadline}"` : ''}
${article.originalTitle ? `Original title: "${article.originalTitle}"` : ''}
${article.originalDesc ? `Description: "${article.originalDesc}"` : ''}

Generate 2 different image prompts for this article:
- Prompt A: Photorealistic/editorial style (like a news magazine photo)
- Prompt B: Artistic/creative style (more abstract, moody, or conceptual)

Both prompts should be in English, detailed (50-80 words each), and describe a scene WITHOUT any text or letters.

Return JSON:
{
  "promptA": "detailed photorealistic prompt here...",
  "promptB": "detailed artistic/creative prompt here..."
}`;

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
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 400,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Prompt generation error:', error);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Extract JSON
        let jsonStr = '';
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        } else {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];
        }

        if (!jsonStr) {
            console.error('Could not find JSON in prompt response');
            return null;
        }

        const parsed = JSON.parse(jsonStr);
        if (!parsed.promptA || !parsed.promptB) {
            console.error('Missing promptA or promptB');
            return null;
        }

        return { promptA: parsed.promptA, promptB: parsed.promptB };
    } catch (error) {
        console.error('Prompt generation failed:', error);
        return null;
    }
}

/**
 * Generate an image using Flux via OpenRouter
 * Returns base64 PNG data URL or null
 */
export async function generateFluxImage(prompt: string): Promise<string | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.FLUX_MODEL || 'black-forest-labs/flux.2-klein-4b';

    if (!apiKey) {
        console.error('OPENROUTER_API_KEY not set');
        return null;
    }

    try {
        console.log(`  🎨 Generating Flux image (${model})...`);
        console.log(`  📝 Prompt: "${prompt.substring(0, 80)}..."`);

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
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                        ],
                    },
                ],
                // Request image output
                modalities: ['image'],
                // Image parameters
                image: {
                    // 4:5 ratio for Instagram (1080x1350)
                    width: 1080,
                    height: 1350,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Flux generation error:', error);
            return null;
        }

        const data = await response.json();

        // Flux returns images in message.images array (NOT in message.content)
        // Format: message.images[].image_url.url = "data:image/png;base64,..."
        const message = data.choices?.[0]?.message;

        // Method 1: Check message.images (OpenRouter Flux format)
        if (message?.images && Array.isArray(message.images)) {
            for (const img of message.images) {
                if (img.image_url?.url) {
                    console.log('  ✅ Flux image received (from message.images)');
                    return img.image_url.url;
                }
            }
        }

        // Method 2: Check content array (fallback for other models)
        if (Array.isArray(message?.content)) {
            for (const part of message.content) {
                if (part.type === 'image_url' && part.image_url?.url) {
                    console.log('  ✅ Flux image received (from content array)');
                    return part.image_url.url;
                }
            }
        }

        // Method 3: Content is a data URL string
        if (typeof message?.content === 'string' && message.content.startsWith('data:image')) {
            console.log('  ✅ Flux image received (from content string)');
            return message.content;
        }

        console.error('Unexpected Flux response format:', JSON.stringify(data).substring(0, 500));
        return null;
    } catch (error) {
        console.error('Flux generation failed:', error);
        return null;
    }
}

/**
 * Apply template overlay on AI-generated image
 * Uses Playwright to render the template with the AI image as background
 */
async function applyTemplateOverlay(
    aiImageBase64: string,
    data: {
        headline: string;
        subheadline?: string;
        category?: string;
        brandHandle?: string;
    }
): Promise<Buffer> {
    const { generateImage } = await import('./image-generator.js');

    return await generateImage('instagram-post', {
        headline: data.headline,
        subheadline: data.subheadline,
        category: data.category,
        imageUrl: aiImageBase64, // base64 data URL works as img src
        brandHandle: data.brandHandle || '@lifestylemedia',
    });
}

/**
 * Main orchestrator: Regen AI images for a content item
 * 1. Fetch article data
 * 2. Generate 2 prompts via LLM
 * 3. Generate 2 images via Flux
 * 4. Apply template overlay on both
 * 5. Upload both to Supabase Storage
 * 6. Send Telegram selection message
 */
export async function regenArticleImages(contentId: string): Promise<boolean> {
    console.log(`\n🎨 AI Image Regen for: ${contentId}`);

    // 1. Fetch content
    const { data: content } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', contentId)
        .single();

    if (!content) {
        await sendTelegramMessage('❌ Content not found');
        return false;
    }

    const headline = content.headline || content.original_title || 'Untitled';
    const subheadline = content.subheadline || content.image_subtext || '';

    // Get category
    let categoryName = 'Lifestyle';
    if (content.category_id) {
        const { data: cat } = await supabase
            .from('categories')
            .select('name')
            .eq('id', content.category_id)
            .single();
        if (cat) categoryName = cat.name;
    }

    // 2. Generate prompts
    await sendTelegramMessage('🧠 Generating image prompts...');
    const prompts = await generateImagePrompts({
        headline,
        subheadline,
        originalTitle: content.original_title,
        originalDesc: content.original_desc,
    });

    if (!prompts) {
        await sendTelegramMessage('❌ Failed to generate image prompts');
        return false;
    }

    console.log('  ✅ Prompts generated');
    console.log(`  A: "${prompts.promptA.substring(0, 60)}..."`);
    console.log(`  B: "${prompts.promptB.substring(0, 60)}..."`);

    // 3. Generate both images in parallel
    await sendTelegramMessage('🎨 Generating 2 AI images...\n\n⏳ This may take 15-30 seconds...');

    const [imageA, imageB] = await Promise.all([
        generateFluxImage(prompts.promptA),
        generateFluxImage(prompts.promptB),
    ]);

    if (!imageA && !imageB) {
        await sendTelegramMessage('❌ Both image generations failed. Try again later.');
        return false;
    }

    // 4. Apply template overlay & upload
    const results: { label: string; url: string }[] = [];

    for (const [label, aiImage, prompt] of [
        ['A', imageA, prompts.promptA],
        ['B', imageB, prompts.promptB],
    ] as [string, string | null, string][]) {
        if (!aiImage) {
            console.log(`  ⚠️ Image ${label} failed, skipping`);
            continue;
        }

        try {
            console.log(`  🖼️ Applying template overlay on Image ${label}...`);
            const templateBuffer = await applyTemplateOverlay(aiImage, {
                headline,
                subheadline,
                category: categoryName,
            });

            // Upload to Supabase Storage
            const fileName = `content-images/${contentId}-ai-${label.toLowerCase()}-${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
                .from('generated-images')
                .upload(fileName, templateBuffer, {
                    contentType: 'image/png',
                    upsert: true,
                });

            if (uploadError) {
                console.error(`  ❌ Upload ${label} failed:`, uploadError.message);
                continue;
            }

            const { data: urlData } = supabase.storage
                .from('generated-images')
                .getPublicUrl(fileName);

            results.push({ label, url: urlData.publicUrl });
            console.log(`  ✅ Image ${label} uploaded: ${urlData.publicUrl.substring(0, 60)}...`);
        } catch (e) {
            console.error(`  ❌ Template overlay ${label} failed:`, e);
        }
    }

    // Close browser after template rendering
    try {
        const { closeBrowser } = await import('./image-generator.js');
        await closeBrowser();
    } catch { }

    if (results.length === 0) {
        await sendTelegramMessage('❌ All image processing failed. Try again.');
        return false;
    }

    // 5. Send selection to Telegram
    const { sendImageSelection } = await import('./telegram.js');
    await sendImageSelection(contentId, results);

    return true;
}
