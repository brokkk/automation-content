import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { crawlAllSources } from './lib/rss-crawler.js';
import { processIncomingItems, regenerateContent } from './lib/content-generator.js';
import { supabase } from './lib/supabase.js';
import { sendTelegramMessage, sendApprovalNotification, sendEditPrompt, answerCallbackQuery, editStates } from './lib/telegram.js';
import { publishContentToInstagram } from './lib/instagram.js';
import { handleCreateCommand, handleBreakingCommand, handleCreateArticleCallback } from './lib/telegram-commands.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve frontend static files (built Vite app)
const frontendPath = path.join(__dirname, '../../dist');
app.use(express.static(frontendPath));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// CONTENT ACTIONS
// ============================================

// Approve content
app.post('/api/content/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { scheduled_at } = req.body;

    const { error } = await supabase
        .from('content_items')
        .update({
            status: 'approved',
            scheduled_at: scheduled_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: 'Content approved' });
});

// Reject content
app.post('/api/content/:id/reject', async (req, res) => {
    const { id } = req.params;

    await supabase
        .from('content_items')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id);

    res.json({ success: true, message: 'Content rejected' });
});

// Regenerate content
app.post('/api/content/:id/regenerate', async (req, res) => {
    const { id } = req.params;

    try {
        await regenerateContent(id);
        res.json({ success: true, message: 'Content regenerated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to regenerate' });
    }
});

// ============================================
// TELEGRAM WEBHOOK - Enhanced with editorial controls
// ============================================

app.post('/api/telegram/webhook', async (req, res) => {
    const { callback_query, message } = req.body;

    // ---- Handle button callbacks ----
    if (callback_query) {
        const { data, from, id: callbackId } = callback_query;
        const [action, contentId] = data.split(':');
        const chatId = String(callback_query.message?.chat?.id || from.id);

        console.log(`📱 Telegram callback: ${action} for ${contentId} from ${from.username}`);

        switch (action) {
            // ✅ APPROVE → Post to Instagram
            case 'approve': {
                await answerCallbackQuery(callbackId, '⏳ Posting to Instagram...');

                await supabase
                    .from('content_items')
                    .update({ status: 'approved', updated_at: new Date().toISOString() })
                    .eq('id', contentId);

                try {
                    const publishResult = await publishContentToInstagram(contentId);
                    if (publishResult.success) {
                        await sendTelegramMessage('✅ <b>Posted to Instagram!</b>\n\nPost ID: ' + publishResult.postId);
                    } else {
                        await sendTelegramMessage('⚠️ Approved but IG failed: ' + (publishResult.error || 'unknown'));
                    }
                } catch (e) {
                    console.error('Instagram publish error:', e);
                    await sendTelegramMessage('❌ Instagram publish error: ' + (e as Error).message);
                }
                break;
            }

            // ✅ CREATE ARTICLE → Generate content for selected article
            case 'create_article': {
                await answerCallbackQuery(callbackId, '⏳ Creating content...');
                await handleCreateArticleCallback(contentId);
                break;
            }

            // 🔄 NEXT ARTICLE → Pick alternative from scored pool
            case 'next_article': {
                await answerCallbackQuery(callbackId, '🔄 Getting next article...');

                // Reject current content
                await supabase
                    .from('content_items')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', contentId);

                // Find next best scored incoming article
                const { data: nextItems } = await supabase
                    .from('content_items')
                    .select('*')
                    .eq('status', 'incoming')
                    .not('original_title', 'is', null)
                    .not('original_image', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!nextItems || nextItems.length === 0) {
                    await sendTelegramMessage('⚠️ No more articles in the pool. Trigger a new RSS crawl first.');
                    break;
                }

                const nextItem = nextItems[0];
                await sendTelegramMessage('🔄 Generating content for new article...\n\n📰 ' + (nextItem.original_title?.substring(0, 60) || 'Untitled'));

                // Generate content for next article
                try {
                    const { processArticleOptimized } = await import('./lib/batch-generator.js');
                    await processArticleOptimized(nextItem, { skipScoring: true });
                    // Notification is sent automatically by processArticleOptimized
                } catch (e) {
                    console.error('Generate error:', e);
                    await sendTelegramMessage('❌ Failed to generate: ' + (e as Error).message);
                }
                break;
            }

            // ✏️ EDIT CAPTION → Enter edit mode
            case 'edit_caption': {
                await answerCallbackQuery(callbackId, '✏️ Edit mode: Caption');
                await sendEditPrompt(chatId, contentId, 'caption');
                break;
            }

            // ✏️ EDIT HEADLINE → Enter edit mode
            case 'edit_headline': {
                await answerCallbackQuery(callbackId, '✏️ Edit mode: Headline');
                await sendEditPrompt(chatId, contentId, 'headline');
                break;
            }

            // 🖼️ REGEN IMAGE → Regenerate template image (re-render with current data)
            case 'regen_image': {
                await answerCallbackQuery(callbackId, '🖼️ Regenerating image...');

                try {
                    // Get the content
                    const { data: content } = await supabase
                        .from('content_items')
                        .select('*')
                        .eq('id', contentId)
                        .single();

                    if (!content) {
                        await sendTelegramMessage('❌ Content not found');
                        break;
                    }

                    // Re-generate template image
                    const { generateImage, closeBrowser } = await import('./lib/image-generator.js');

                    const imageBuffer = await generateImage('instagram-post', {
                        headline: content.headline || content.original_title || 'Untitled',
                        subheadline: content.subheadline || content.image_subtext || '',
                        category: 'Lifestyle',
                        imageUrl: content.original_image || undefined,
                        brandHandle: '@lifestylemedia',
                    });

                    // Upload to Supabase Storage
                    const fileName = `content-images/${contentId}-regen-${Date.now()}.png`;
                    const { error: uploadError } = await supabase.storage
                        .from('generated-images')
                        .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

                    if (uploadError) {
                        await sendTelegramMessage('⚠️ Image upload failed: ' + uploadError.message);
                        break;
                    }

                    const { data: urlData } = supabase.storage
                        .from('generated-images')
                        .getPublicUrl(fileName);

                    // Update DB
                    await supabase
                        .from('content_items')
                        .update({ generated_image_url: urlData.publicUrl })
                        .eq('id', contentId);

                    // Re-send notification with new image
                    const { data: updatedContent } = await supabase
                        .from('content_items')
                        .select('*')
                        .eq('id', contentId)
                        .single();

                    if (updatedContent) {
                        await sendApprovalNotification(updatedContent);
                    }

                    await closeBrowser();
                } catch (e) {
                    console.error('Image regen error:', e);
                    await sendTelegramMessage('❌ Image regeneration failed: ' + (e as Error).message);
                }
                break;
            }

            // ❌ REJECT
            case 'reject': {
                await answerCallbackQuery(callbackId, '❌ Rejected');
                await supabase
                    .from('content_items')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', contentId);
                await sendTelegramMessage('❌ Content rejected.');
                break;
            }
        }
    }

    // ---- Handle text messages (for edit mode) ----
    if (message?.text && !message.text.startsWith('/')) {
        const chatId = String(message.chat.id);
        const editState = editStates.get(chatId);

        if (editState) {
            const { contentId, field } = editState;
            const newText = message.text.trim();

            console.log(`✏️ Edit ${field} for ${contentId}: "${newText.substring(0, 30)}..."`);

            // Update the field in database
            const updateData: Record<string, string> = { updated_at: new Date().toISOString() };

            if (field === 'caption') {
                updateData.ig_caption = newText;
            } else if (field === 'headline') {
                updateData.headline = newText;
            }

            await supabase
                .from('content_items')
                .update(updateData)
                .eq('id', contentId);

            // Clear edit state
            editStates.delete(chatId);

            // If headline changed, re-generate template image
            if (field === 'headline') {
                await sendTelegramMessage('🎨 Headline updated! Regenerating template image...');

                try {
                    const { data: content } = await supabase
                        .from('content_items')
                        .select('*')
                        .eq('id', contentId)
                        .single();

                    if (content) {
                        const { generateImage, closeBrowser } = await import('./lib/image-generator.js');

                        const imageBuffer = await generateImage('instagram-post', {
                            headline: newText,
                            subheadline: content.image_subtext || '',
                            category: 'Lifestyle',
                            imageUrl: content.original_image || undefined,
                            brandHandle: '@lifestylemedia',
                        });

                        const fileName = `content-images/${contentId}-edited-${Date.now()}.png`;
                        const { error: uploadError } = await supabase.storage
                            .from('generated-images')
                            .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

                        if (!uploadError) {
                            const { data: urlData } = supabase.storage
                                .from('generated-images')
                                .getPublicUrl(fileName);

                            await supabase
                                .from('content_items')
                                .update({ generated_image_url: urlData.publicUrl })
                                .eq('id', contentId);
                        }

                        await closeBrowser();

                        // Re-send notification
                        const { data: updatedContent } = await supabase
                            .from('content_items')
                            .select('*')
                            .eq('id', contentId)
                            .single();

                        if (updatedContent) {
                            await sendApprovalNotification(updatedContent);
                        }
                    }
                } catch (e) {
                    console.error('Image regen after edit error:', e);
                    await sendTelegramMessage('⚠️ Image regen failed, but headline was updated.');
                }
            } else {
                // Caption edit — just re-send notification
                const { data: updatedContent } = await supabase
                    .from('content_items')
                    .select('*')
                    .eq('id', contentId)
                    .single();

                if (updatedContent) {
                    await sendApprovalNotification(updatedContent);
                } else {
                    await sendTelegramMessage('✅ Caption updated!');
                }
            }
        }
    }

    // Handle /cancel command
    if (message?.text === '/cancel') {
        const chatId = String(message.chat.id);
        if (editStates.has(chatId)) {
            editStates.delete(chatId);
            await sendTelegramMessage('❌ Edit cancelled.');
        }
    }

    // Handle /create command — manual content from best-scored pool
    if (message?.text === '/create') {
        await handleCreateCommand();
    }

    // Handle /breaking command — instant crawl + create for trending news
    if (message?.text?.startsWith('/breaking')) {
        const keyword = message.text.replace('/breaking', '').trim();
        await handleBreakingCommand(keyword);
    }

    res.json({ ok: true });
});

// ============================================
// MANUAL TRIGGERS
// ============================================

// Trigger RSS crawl manually
app.post('/api/crawl', async (req, res) => {
    const result = await crawlAllSources();
    res.json({ success: true, ...result });
});

// Crawl Google News by keyword
app.post('/api/crawl/google-news', async (req, res) => {
    const { keyword, lang = 'id', country = 'ID' } = req.body;

    if (!keyword) {
        return res.status(400).json({ error: 'keyword is required' });
    }

    const { crawlGoogleNews } = await import('./lib/rss-crawler.js');
    const result = await crawlGoogleNews(keyword, { lang, country });
    res.json({ success: true, keyword, ...result });
});

// Trigger AI generation manually
app.post('/api/generate', async (req, res) => {
    const count = await processIncomingItems();
    res.json({ success: true, processed: count });
});

// Optimized generation (1 LLM call per article, no separate scoring)
app.post('/api/generate-optimized', async (req, res) => {
    const { maxItems = 5 } = req.body;

    // Import optimized modules
    const { processArticlesOptimized } = await import('./lib/batch-generator.js');

    // Get incoming items
    const { data: items } = await supabase
        .from('content_items')
        .select('*')
        .eq('status', 'incoming')
        .order('created_at', { ascending: false })
        .limit(maxItems);

    if (!items || items.length === 0) {
        return res.json({ success: true, processed: 0, message: 'No incoming items' });
    }

    const processed = await processArticlesOptimized(items, { maxItems });
    res.json({
        success: true,
        processed,
        llmCalls: processed, // 1 call per article
        message: `Processed ${processed} articles with ${processed} LLM calls`
    });
});

// Fully automated pipeline: Curate → Generate → Ready for approval
app.post('/api/auto-pipeline', async (req, res) => {
    const {
        maxPerCategory = 3,
        maxTotal = 15
    } = req.body || {};

    console.log('\n🤖 AUTO PIPELINE TRIGGERED');

    const { runAutoPipeline } = await import('./lib/auto-curator.js');
    const result = await runAutoPipeline({ maxPerCategory, maxTotal });

    res.json({
        success: true,
        ...result,
        message: `Auto-curated ${result.curated} articles, generated ${result.generated} posts`
    });
});

// ============================================
// CRON JOBS - FULL AUTOMATION
// ============================================

// Crawl RSS feeds every 6 hours
cron.schedule('0 */6 * * *', async () => {
    console.log('\n⏰ [CRON] Scheduled RSS crawl starting...');
    await crawlAllSources();
    console.log('✅ [CRON] Crawl complete');
});

// Auto-curate and generate content 2x per day (9am & 5pm WIB)
// Config: maxPerCategory=1, maxTotal=3 → 3 posts per run × 2 = 6 posts/day
cron.schedule('0 2,10 * * *', async () => {
    // 2:00 UTC = 9:00 WIB, 10:00 UTC = 17:00 WIB
    console.log('\n🤖 [CRON] Auto-pipeline starting...');
    const { runAutoPipeline } = await import('./lib/auto-curator.js');
    const result = await runAutoPipeline({ maxPerCategory: 1, maxTotal: 3 });
    console.log(`✅ [CRON] Auto-pipeline complete: ${result.generated} posts generated`);
});

// ============================================
// START SERVER
// ============================================

// SPA catch-all: serve index.html for any non-API route (React Router)
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath);
});

app.listen(PORT, () => {
    console.log(`
🚀 AI Content Pipeline Server
================================
Port: ${PORT}
Time: ${new Date().toISOString()}

Endpoints:
  GET  /health                    - Health check
  POST /api/content/:id/approve   - Approve content
  POST /api/content/:id/reject    - Reject content  
  POST /api/content/:id/regenerate - Regenerate content
  POST /api/telegram/webhook      - Telegram callback
  POST /api/crawl                 - Trigger RSS crawl
  POST /api/generate              - Trigger AI generation

Cron Jobs:
  RSS Crawl + AI Generate: Every 2 hours
================================
  `);
});
