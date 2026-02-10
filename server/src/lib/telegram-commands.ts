/**
 * Telegram Bot Commands
 * /create - Manual content creation from best-scored incoming articles
 * /breaking <keyword> - Instant crawl + create for breaking/trending news
 */

import { supabase, type TelegramSettings } from './supabase.js';
import { sendTelegramMessage } from './telegram.js';
import { calculateRelevanceScore } from './auto-curator.js';

// Get Telegram settings from database (same as telegram.ts)
async function getSettings(): Promise<TelegramSettings | null> {
    const { data, error } = await supabase
        .from('telegram_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

    if (error) return null;
    return data;
}

// Telegram API helper for inline keyboard messages
async function sendMessageWithButtons(text: string, buttons: { text: string; callback_data: string }[][]) {
    const settings = await getSettings();
    if (!settings) return false;

    const url = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: settings.chat_id,
            text,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons },
        }),
    });

    return response.ok;
}

/**
 * /create — Show top-scored incoming articles for manual content creation
 */
export async function handleCreateCommand(): Promise<void> {
    console.log('📱 /create command received');

    await sendTelegramMessage('🔍 Mencari artikel terbaik dari pool...');

    // Get incoming articles with images
    const { data: items, error } = await supabase
        .from('content_items')
        .select('*, source:rss_sources(name), category:categories(name)')
        .eq('status', 'incoming')
        .not('original_title', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error || !items || items.length === 0) {
        await sendTelegramMessage('⚠️ Tidak ada artikel incoming. Jalankan crawl dulu atau tunggu jadwal auto-crawl.');
        return;
    }

    // Score all articles
    const scored = items.map(item => ({
        ...item,
        score: calculateRelevanceScore({
            title: item.original_title || '',
            description: item.original_desc || '',
            createdAt: item.created_at,
        }),
    }));

    // Sort by score and take top 5
    const top5 = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    // Build message
    let message = '📊 <b>Top 5 Artikel Terbaik</b>\n\n';
    message += 'Pilih artikel untuk di-create:\n\n';

    const buttons: { text: string; callback_data: string }[][] = [];

    top5.forEach((item, index) => {
        const num = index + 1;
        const title = (item.original_title || 'Untitled').substring(0, 60);
        const source = item.source?.name || 'Unknown';
        const category = item.category?.name || '';
        const ageHours = Math.round((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60));
        const ageStr = ageHours < 1 ? 'baru' : ageHours < 24 ? `${ageHours}j lalu` : `${Math.round(ageHours / 24)}h lalu`;

        message += `<b>${num}.</b> ${title}\n`;
        message += `   📰 ${source}${category ? ' • ' + category : ''} • ⏰ ${ageStr} • ⭐ ${item.score}\n\n`;

        buttons.push([
            { text: `✅ Create #${num}: ${title.substring(0, 30)}...`, callback_data: `create_article:${item.id}` }
        ]);
    });

    message += '\nTap tombol di bawah untuk create content:';

    await sendMessageWithButtons(message, buttons);
}

/**
 * /breaking <keyword> — Crawl Google News for keyword, show top articles
 */
export async function handleBreakingCommand(keyword: string): Promise<void> {
    console.log(`📱 /breaking command received with keyword: "${keyword}"`);

    if (!keyword || keyword.trim().length === 0) {
        await sendTelegramMessage(
            '⚠️ <b>Format:</b> /breaking [keyword]\n\n' +
            'Contoh:\n' +
            '• /breaking gempa jakarta\n' +
            '• /breaking teknologi AI\n' +
            '• /breaking piala dunia'
        );
        return;
    }

    await sendTelegramMessage(`🔥 <b>BREAKING NEWS MODE</b>\n\n🔍 Crawling berita terbaru: "<i>${keyword}</i>"...`);

    try {
        // Crawl Google News
        const { crawlGoogleNews } = await import('./rss-crawler.js');
        const result = await crawlGoogleNews(keyword, { lang: 'id', country: 'ID' }) as any;

        console.log(`   Crawled: ${result.saved || result.added || 0} new, ${result.fetched || result.total || 0} total`);

        if (!result.saved && !result.added && !result.fetched && !result.total) {
            await sendTelegramMessage(`⚠️ Tidak ada hasil untuk "${keyword}". Coba keyword lain.`);
            return;
        }

        await sendTelegramMessage(`✅ Ditemukan ${result.saved || result.added || 0} artikel baru!\n\n🔍 Scoring dan memilih yang terbaik...`);

        // Get freshly crawled incoming articles (most recent ones)
        const { data: items } = await supabase
            .from('content_items')
            .select('*, source:rss_sources(name), category:categories(name)')
            .eq('status', 'incoming')
            .not('original_title', 'is', null)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!items || items.length === 0) {
            await sendTelegramMessage('⚠️ Tidak ada artikel yang bisa diproses.');
            return;
        }

        // Filter by keyword relevance and score
        const keywordLower = keyword.toLowerCase();
        const relevant = items.filter(item => {
            const combined = `${item.original_title || ''} ${item.original_desc || ''}`.toLowerCase();
            return keywordLower.split(' ').some(kw => combined.includes(kw));
        });

        const toScore = relevant.length > 0 ? relevant : items.slice(0, 10);

        const scored = toScore.map(item => ({
            ...item,
            score: calculateRelevanceScore({
                title: item.original_title || '',
                description: item.original_desc || '',
                createdAt: item.created_at,
            }),
        }));

        // Top 3
        const top3 = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        // Build message
        let message = `🔥 <b>Breaking: "${keyword}"</b>\n\n`;
        message += 'Top 3 artikel:\n\n';

        const buttons: { text: string; callback_data: string }[][] = [];

        top3.forEach((item, index) => {
            const num = index + 1;
            const title = (item.original_title || 'Untitled').substring(0, 60);
            const source = item.source?.name || 'Google News';

            message += `<b>${num}.</b> ${title}\n`;
            message += `   📰 ${source} • ⭐ ${item.score}\n\n`;

            buttons.push([
                { text: `🔥 Create #${num}: ${title.substring(0, 30)}...`, callback_data: `create_article:${item.id}` }
            ]);
        });

        message += '\nTap tombol untuk create content instant:';

        await sendMessageWithButtons(message, buttons);

    } catch (e) {
        console.error('Breaking news error:', e);
        await sendTelegramMessage('❌ Gagal crawl: ' + (e as Error).message);
    }
}

/**
 * Handle create_article callback — Generate AI content + template image for selected article
 */
export async function handleCreateArticleCallback(articleId: string): Promise<void> {
    console.log(`📱 Creating content for article: ${articleId}`);

    await sendTelegramMessage('⏳ Generating AI content + template image...');

    try {
        // Get article
        const { data: article } = await supabase
            .from('content_items')
            .select('*')
            .eq('id', articleId)
            .single();

        if (!article) {
            await sendTelegramMessage('❌ Artikel tidak ditemukan.');
            return;
        }

        // Generate content using batch generator
        const { processArticleOptimized } = await import('./batch-generator.js');
        await processArticleOptimized(article, { skipScoring: true });

        // processArticleOptimized already sends the approval notification
        console.log('   ✅ Content generated and notification sent');

    } catch (e) {
        console.error('Create article error:', e);
        await sendTelegramMessage('❌ Gagal generate: ' + (e as Error).message);
    }
}
