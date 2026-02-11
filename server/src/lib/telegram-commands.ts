/**
 * Telegram Bot Commands
 * /create - Manual content creation from best-scored incoming articles
 * /breaking <keyword> - Instant crawl + create for breaking/trending news
 * /crawl - Full RSS crawl + paginated article browsing
 */

import { supabase, type TelegramSettings } from './supabase.js';
import { sendTelegramMessage, editMessageWithButtons } from './telegram.js';
import { calculateRelevanceScore } from './auto-curator.js';

const PAGE_SIZE = 5;

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
 * Score and sort all incoming articles
 */
async function getScoredSortedArticles() {
    const { data: items, error } = await supabase
        .from('content_items')
        .select('*, source:rss_sources(name, category:categories(name))')
        .eq('status', 'incoming')
        .not('original_title', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

    if (error || !items || items.length === 0) return [];

    return items.map(item => ({
        ...item,
        score: calculateRelevanceScore({
            title: item.original_title || '',
            description: item.original_desc || '',
            createdAt: item.created_at,
        }),
    })).sort((a, b) => b.score - a.score);
}

/**
 * Get unique categories from articles
 */
function getCategories(articles: any[]): string[] {
    const cats = new Set<string>();
    articles.forEach(a => {
        const name = a.source?.category?.name;
        if (name) cats.add(name);
    });
    return Array.from(cats).sort();
}

/** Get category name from an article (via source) */
function getArticleCategory(article: any): string {
    return article.source?.category?.name || '';
}

/**
 * Build article list message + buttons for a given page/mode/category
 * Compact callback format: br:PAGE:MODE:CATEGORY
 *   MODE: s=score, r=random
 *   CATEGORY: all=no filter, or category name (truncated to fit 64 bytes)
 */
function buildArticleListMessage(
    allArticles: any[],
    page: number,
    mode: 'score' | 'random',
    category: string,
): { text: string; buttons: { text: string; callback_data: string }[][] } {
    // Filter by category
    let filtered = category === 'all'
        ? allArticles
        : allArticles.filter(a => getArticleCategory(a).toLowerCase() === category.toLowerCase());

    // Random mode: shuffle
    if (mode === 'random') {
        filtered = [...filtered].sort(() => Math.random() - 0.5);
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    // Build text
    const modeLabel = mode === 'random' ? '🔀 Random' : '🏆 By Score';
    const catLabel = category === 'all' ? 'All Categories' : `📂 ${category}`;
    let text = `📋 <b>Articles</b> — ${modeLabel} — ${catLabel}\n`;
    text += `📊 ${totalItems} articles • Page ${safePage + 1}/${totalPages || 1}\n\n`;

    if (pageItems.length === 0) {
        text += '<i>No articles found.</i>\n';
    }

    const buttons: { text: string; callback_data: string }[][] = [];

    pageItems.forEach((item, index) => {
        const num = start + index + 1;
        const title = (item.original_title || 'Untitled').substring(0, 55);
        const source = item.source?.name || 'Unknown';
        const cat = getArticleCategory(item);
        const ageHours = Math.round((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60));
        const ageStr = ageHours < 1 ? 'baru' : ageHours < 24 ? `${ageHours}j` : `${Math.round(ageHours / 24)}h`;

        text += `<b>${num}.</b> ${title}\n`;
        text += `   📰 ${source}${cat ? ' • ' + cat : ''} • ⏰ ${ageStr} • ⭐ ${item.score}\n\n`;

        buttons.push([
            { text: `🔥 Create #${num}: ${title.substring(0, 25)}...`, callback_data: `create_article:${item.id}` }
        ]);
    });

    // Compact callback: br:page:mode:category
    const catShort = category.substring(0, 15).toLowerCase();
    const m = mode === 'random' ? 'r' : 's';

    // Navigation row
    const navRow: { text: string; callback_data: string }[] = [];
    if (safePage > 0) {
        navRow.push({ text: '⬅️ Prev 5', callback_data: `br:${safePage - 1}:${m}:${catShort}` });
    }
    if (safePage < totalPages - 1) {
        navRow.push({ text: '➡️ Next 5', callback_data: `br:${safePage + 1}:${m}:${catShort}` });
    }
    if (navRow.length > 0) buttons.push(navRow);

    // Mode toggle row
    const modeRow: { text: string; callback_data: string }[] = [];
    if (mode !== 'score') {
        modeRow.push({ text: '🏆 By Score', callback_data: `br:0:s:${catShort}` });
    }
    modeRow.push({ text: '🔀 Random 5', callback_data: `br:0:r:${catShort}` });
    buttons.push(modeRow);

    // Category filter rows
    const categories = getCategories(allArticles);
    if (categories.length > 1) {
        const catRow: { text: string; callback_data: string }[] = [];
        if (category !== 'all') {
            catRow.push({ text: '📋 All', callback_data: `br:0:${m}:all` });
        }
        categories.slice(0, 3).forEach(cat => {
            if (cat.toLowerCase() !== category.toLowerCase()) {
                const cs = cat.substring(0, 12);
                catRow.push({ text: `📂 ${cs}`, callback_data: `br:0:${m}:${cs.toLowerCase()}` });
            }
        });
        if (catRow.length > 0) buttons.push(catRow);

        if (categories.length > 3) {
            const catRow2: { text: string; callback_data: string }[] = [];
            categories.slice(3, 6).forEach(cat => {
                if (cat.toLowerCase() !== category.toLowerCase()) {
                    const cs = cat.substring(0, 12);
                    catRow2.push({ text: `📂 ${cs}`, callback_data: `br:0:${m}:${cs.toLowerCase()}` });
                }
            });
            if (catRow2.length > 0) buttons.push(catRow2);
        }
    }

    return { text, buttons };
}

/**
 * /create — Show top-scored incoming articles for manual content creation
 */
export async function handleCreateCommand(): Promise<void> {
    console.log('📱 /create command received');

    await sendTelegramMessage('🔍 Mencari artikel terbaik dari pool...');

    const scored = await getScoredSortedArticles();

    if (scored.length === 0) {
        await sendTelegramMessage('⚠️ Tidak ada artikel incoming. Jalankan /crawl dulu.');
        return;
    }

    const { text, buttons } = buildArticleListMessage(scored, 0, 'score', 'all');
    await sendMessageWithButtons(text, buttons);
}

/**
 * /browse — Show articles from last crawl (no new crawl)
 */
export async function handleBrowseCommand(): Promise<void> {
    console.log('📱 /browse command received');

    await sendTelegramMessage('🔍 Loading articles...');

    const scored = await getScoredSortedArticles();

    if (scored.length === 0) {
        await sendTelegramMessage('⚠️ Tidak ada artikel incoming. Jalankan /crawl dulu.');
        return;
    }

    const categories = getCategories(scored);
    let summary = `📋 <b>${scored.length} articles available</b>\n\n`;
    if (categories.length > 0) {
        categories.forEach(cat => {
            const count = scored.filter(a => getArticleCategory(a) === cat).length;
            summary += `  📂 ${cat} — ${count}\n`;
        });
        summary += '\n';
    }
    await sendTelegramMessage(summary);

    const { text, buttons } = buildArticleListMessage(scored, 0, 'score', 'all');
    await sendMessageWithButtons(text, buttons);
}

/**
 * /crawl — Full RSS crawl + show articles with browsing
 */
export async function handleCrawlCommand(): Promise<void> {
    console.log('📱 /crawl command received');

    await sendTelegramMessage('⏳ Crawling RSS feeds...');

    try {
        const { crawlAllSources } = await import('./rss-crawler.js');
        const result = await crawlAllSources();

        console.log(`   Crawled: ${result.saved} saved from ${result.sources} sources, ${result.total} total`);

        const scored = await getScoredSortedArticles();

        if (scored.length === 0) {
            await sendTelegramMessage(`✅ Crawl selesai (${result.saved} baru) tapi tidak ada artikel yang bisa diproses.`);
            return;
        }

        // Category summary
        const categories = getCategories(scored);
        let summary = `✅ <b>Crawl Complete!</b>\n\n`;
        summary += `📊 ${result.saved} new articles • ${scored.length} total incoming\n\n`;

        if (categories.length > 0) {
            summary += '📂 Categories:\n';
            categories.forEach(cat => {
                const count = scored.filter(a => getArticleCategory(a) === cat).length;
                summary += `  • ${cat} — ${count} articles\n`;
            });
            summary += '\n';
        }

        await sendTelegramMessage(summary + '🔍 Loading top articles...');

        const { text, buttons } = buildArticleListMessage(scored, 0, 'score', 'all');
        await sendMessageWithButtons(text, buttons);

    } catch (e) {
        console.error('Crawl error:', e);
        await sendTelegramMessage('❌ Crawl failed: ' + (e as Error).message);
    }
}

/**
 * Handle browse callback — pagination, random, category filter
 * Callback format: br:PAGE:MODE:CATEGORY
 */
export async function handleBrowseCallback(
    chatId: string,
    messageId: number,
    callbackData: string,
): Promise<void> {
    const parts = callbackData.split(':');
    const page = parseInt(parts[1] || '0', 10);
    const mode = parts[2] === 'r' ? 'random' : 'score' as 'score' | 'random';
    const category = parts[3] || 'all';

    console.log(`📱 Browse: page=${page}, mode=${mode}, category=${category}`);

    const scored = await getScoredSortedArticles();

    if (scored.length === 0) return;

    const { text, buttons } = buildArticleListMessage(scored, page, mode, category);
    await editMessageWithButtons(chatId, messageId, text, buttons);
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
        const { crawlGoogleNews } = await import('./rss-crawler.js');
        const result = await crawlGoogleNews(keyword, { lang: 'id', country: 'ID' }) as any;

        console.log(`   Crawled: ${result.saved || result.added || 0} new, ${result.fetched || result.total || 0} total`);

        if (!result.saved && !result.added && !result.fetched && !result.total) {
            await sendTelegramMessage(`⚠️ Tidak ada hasil untuk "${keyword}". Coba keyword lain.`);
            return;
        }

        await sendTelegramMessage(`✅ Ditemukan ${result.saved || result.added || 0} artikel baru!\n\n🔍 Scoring dan memilih yang terbaik...`);

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

        const top3 = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

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
        const { data: article } = await supabase
            .from('content_items')
            .select('*')
            .eq('id', articleId)
            .single();

        if (!article) {
            await sendTelegramMessage('❌ Artikel tidak ditemukan.');
            return;
        }

        const { processArticleOptimized } = await import('./batch-generator.js');
        await processArticleOptimized(article, { skipScoring: true });

        console.log('   ✅ Content generated and notification sent');

    } catch (e) {
        console.error('Create article error:', e);
        await sendTelegramMessage('❌ Gagal generate: ' + (e as Error).message);
    }
}
