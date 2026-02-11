import { supabase, type TelegramSettings, type ContentItem } from './supabase.js';

// ============================================
// TELEGRAM BOT INTEGRATION
// Enhanced with photo notifications & edit mode
// ============================================

// In-memory edit state tracker
// Maps chatId to { contentId, field } for tracking edit mode
export const editStates: Map<string, { contentId: string; field: 'caption' | 'headline' | 'subheadline' }> = new Map();

// Get Telegram settings from database
async function getSettings(): Promise<TelegramSettings | null> {
    const { data, error } = await supabase
        .from('telegram_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching telegram settings:', error);
        return null;
    }

    return data;
}

// ============================================
// CORE: Send Text Message
// ============================================
export async function sendTelegramMessage(
    text: string,
    replyMarkup?: object
): Promise<boolean> {
    const settings = await getSettings();
    if (!settings) {
        console.log('     Telegram not configured');
        return false;
    }

    try {
        const body: any = {
            chat_id: settings.chat_id,
            text,
            parse_mode: 'HTML',
        };

        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }

        console.log('     Calling Telegram API...');
        const response = await fetch(
            `https://api.telegram.org/bot${settings.bot_token}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );

        const result = await response.json();
        console.log('     Telegram API result:', result.ok ? 'OK' : result.description);
        return result.ok === true;
    } catch (error) {
        console.error('     Telegram send failed:', error);
        return false;
    }
}

// ============================================
// Edit existing message (for pagination)
// ============================================
export async function editMessageWithButtons(
    chatId: string,
    messageId: number,
    text: string,
    buttons: { text: string; callback_data: string }[][]
): Promise<boolean> {
    const settings = await getSettings();
    if (!settings) return false;

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${settings.bot_token}/editMessageText`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: buttons },
                }),
            }
        );

        const result = await response.json();
        return result.ok === true;
    } catch (error) {
        console.error('     Telegram edit failed:', error);
        return false;
    }
}

// ============================================
// CORE: Send Photo with Caption & Buttons
// ============================================
export async function sendPhotoNotification(
    photoUrl: string,
    caption: string,
    replyMarkup?: object
): Promise<boolean> {
    const settings = await getSettings();
    if (!settings) {
        console.log('     Telegram not configured');
        return false;
    }

    try {
        const body: any = {
            chat_id: settings.chat_id,
            photo: photoUrl,
            caption,
            parse_mode: 'HTML',
        };

        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }

        console.log('     Sending photo notification...');
        const response = await fetch(
            `https://api.telegram.org/bot${settings.bot_token}/sendPhoto`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );

        const result = await response.json();
        console.log('     Telegram sendPhoto result:', result.ok ? 'OK' : result.description);
        return result.ok === true;
    } catch (error) {
        console.error('     Telegram sendPhoto failed:', error);
        return false;
    }
}

// ============================================
// CORE: Answer Callback Query
// ============================================
export async function answerCallbackQuery(
    callbackQueryId: string,
    text: string
): Promise<void> {
    const settings = await getSettings();
    if (!settings) return;

    try {
        await fetch(
            `https://api.telegram.org/bot${settings.bot_token}/answerCallbackQuery`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: callbackQueryId,
                    text,
                }),
            }
        );
    } catch (error) {
        console.error('     answerCallbackQuery failed:', error);
    }
}

// ============================================
// Build approval keyboard buttons
// ============================================
function buildApprovalKeyboard(contentId: string) {
    return {
        inline_keyboard: [
            [
                { text: '✅ Approve & Post', callback_data: `approve:${contentId}` },
                { text: '🔄 Next Article', callback_data: `next_article:${contentId}` },
            ],
            [
                { text: '✏️ Edit Caption', callback_data: `edit_caption:${contentId}` },
                { text: '✏️ Edit Headline', callback_data: `edit_headline:${contentId}` },
            ],
            [
                { text: '✏️ Edit Subheadline', callback_data: `edit_subheadline:${contentId}` },
                { text: '🖼️ Regen Image (AI)', callback_data: `regen_image:${contentId}` },
            ],
            [
                { text: '❌ Reject', callback_data: `reject:${contentId}` },
            ],
        ],
    };
}

// ============================================
// MAIN: Send Content Approval Notification
// Auto-generates template image if not available
// Sends template image as photo with caption preview
// ============================================
export async function sendApprovalNotification(item: ContentItem): Promise<boolean> {
    const settings = await getSettings();
    console.log('     Telegram settings:', settings ? 'found' : 'NOT FOUND');
    console.log('     notify_on_new_content:', settings?.notify_on_new_content);

    if (!settings?.notify_on_new_content) {
        console.log('     Skipping notification (not enabled)');
        return false;
    }

    // Auto-generate template image if not available
    let imageUrl = (item as any).generated_image_url;

    if (!imageUrl) {
        console.log('     🎨 No template image found, generating...');
        try {
            // Scrape high-res og:image from article (RSS images are often low quality)
            let bgImageUrl = item.original_image;
            if (item.original_url) {
                const { scrapeArticleImage } = await import('./image-scraper.js');
                const scrapedImage = await scrapeArticleImage(item.original_url);
                if (scrapedImage) {
                    bgImageUrl = scrapedImage;
                    console.log('     🔍 Using scraped og:image (high-res):', scrapedImage.substring(0, 60) + '...');
                    // Update DB with better image
                    await supabase
                        .from('content_items')
                        .update({ original_image: scrapedImage })
                        .eq('id', item.id);
                }
            }

            const { generateImage, closeBrowser } = await import('./image-generator.js');

            // Get category from source
            let categoryLabel = 'Lifestyle';
            if ((item as any).source_id) {
                const { data: src } = await supabase
                    .from('rss_sources')
                    .select('category:categories(name)')
                    .eq('id', (item as any).source_id)
                    .single();
                if ((src as any)?.category?.name) categoryLabel = (src as any).category.name;
            }

            const imageBuffer = await generateImage('instagram-post', {
                headline: item.headline || item.original_title || 'Untitled',
                subheadline: item.subheadline || item.image_subtext || '',
                category: categoryLabel,
                imageUrl: bgImageUrl || undefined,
                brandHandle: '@lifestylemedia',
            });

            // Upload to Supabase Storage
            const fileName = `content-images/${item.id}-${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
                .from('generated-images')
                .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

            if (!uploadError) {
                const { data: urlData } = supabase.storage
                    .from('generated-images')
                    .getPublicUrl(fileName);

                imageUrl = urlData.publicUrl;

                // Save to DB for future use
                await supabase
                    .from('content_items')
                    .update({ generated_image_url: imageUrl })
                    .eq('id', item.id);

                console.log('     📤 Template image uploaded:', imageUrl?.substring(0, 60) + '...');
            } else {
                console.log('     ⚠️ Storage upload failed:', uploadError.message);
            }

            await closeBrowser();
        } catch (err) {
            console.error('     ⚠️ Image generation failed:', err);
        }
    }

    // Build notification
    const headline = item.headline || item.original_title || 'Untitled';
    const subheadline = item.subheadline || item.image_subtext || '';
    const igCaption = item.ig_caption || '';

    // Short caption for photo (Telegram limit = 1024 chars)
    const photoCaption = `🆕 <b>New Content Ready!</b>\n\n<b>📰 ${headline}</b>\n${subheadline ? `📌 ${subheadline}\n` : ''}\n🔗 <a href="${item.original_url}">Original Article</a>`;

    // Full caption as separate message
    const fullCaptionMsg = `📝 <b>Full Caption:</b>\n\n${igCaption}`;

    const keyboard = buildApprovalKeyboard(item.id);

    // Send with template image
    if (imageUrl) {
        console.log('     Sending photo notification with template image...');
        const photoSent = await sendPhotoNotification(imageUrl, photoCaption, keyboard);

        if (photoSent) {
            // Send full caption as separate message (no truncation)
            if (igCaption.length > 0) {
                await sendTelegramMessage(fullCaptionMsg);
            }
            return true;
        }

        // Fallback: if photo fails, send text-only
        console.log('     Photo failed, falling back to text notification...');
    }

    // Fallback: text-only notification  
    const fallbackText = `${photoCaption}\n\n📝 <b>Caption:</b>\n${igCaption}`;
    return sendTelegramMessage(fallbackText, keyboard);
}

// ============================================
// Send edit prompt to user
// ============================================
export async function sendEditPrompt(
    chatId: string,
    contentId: string,
    field: 'caption' | 'headline' | 'subheadline'
): Promise<boolean> {
    // Store edit state
    editStates.set(chatId, { contentId, field });

    const fieldLabels: Record<string, string> = {
        caption: 'Instagram Caption',
        headline: 'Headline',
        subheadline: 'Subheadline',
    };

    const text = `✏️ <b>Edit Mode: ${fieldLabels[field]}</b>

Reply with the new ${fieldLabels[field].toLowerCase()}.

Type /cancel to cancel editing.`;

    return sendTelegramMessage(text);
}

// ============================================
// Send publish success notification
// ============================================
export async function sendPublishSuccessNotification(item: ContentItem): Promise<boolean> {
    const settings = await getSettings();
    if (!settings?.notify_on_publish_success) return false;

    const text = `✅ <b>Posted to Instagram!</b>

📰 ${item.headline || item.original_title}`;

    return sendTelegramMessage(text);
}

// ============================================
// Send error notification
// ============================================
export async function sendErrorNotification(message: string): Promise<boolean> {
    const settings = await getSettings();
    if (!settings?.notify_on_publish_error) return false;

    const text = `❌ <b>Error</b>

${message}`;

    return sendTelegramMessage(text);
}

// ============================================
// Send AI Image Selection (2 options)
// ============================================
export async function sendImageSelection(
    contentId: string,
    images: { label: string; url: string }[]
): Promise<boolean> {
    const settings = await getSettings();
    if (!settings) return false;

    // Send each image with a select button
    for (const img of images) {
        const caption = `🖼️ <b>Option ${img.label}</b>\n\nTap to select this image:`;
        const keyboard = {
            inline_keyboard: [
                [{ text: `✅ Select Image ${img.label}`, callback_data: `select_image_${img.label.toLowerCase()}:${contentId}` }],
            ],
        };

        await sendPhotoNotification(img.url, caption, keyboard);

        // Small delay between sends
        await new Promise(r => setTimeout(r, 500));
    }

    await sendTelegramMessage(
        `🎨 <b>AI Image Options</b>\n\n` +
        `${images.length} image${images.length > 1 ? 's' : ''} generated! Tap the button below the image you prefer.\n\n` +
        `💡 <i>Each image uses a different style — pick the one that fits best.</i>`
    );

    return true;
}
