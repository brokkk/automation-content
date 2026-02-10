/**
 * RSS Crawler - Enhanced with patterns from Social Listening App
 * Features: Content hash deduplication, Google News RSS, better headers
 */

import Parser from 'rss-parser';
import crypto from 'crypto';
import { supabase, type RssSource, type ContentItem } from './supabase.js';

const parser = new Parser({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
    },
});

/**
 * Generate content hash for deduplication (same as Social Listening App)
 */
function generateContentHash(title: string, url: string): string {
    const normalized = `${title.toLowerCase().trim()}|${url.toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 64);
}

/**
 * Build Google News RSS URL for keyword-based crawling
 */
export function buildGoogleNewsRssUrl(
    keyword: string,
    options: { lang?: string; country?: string } = {}
): string {
    const { lang = 'id', country = 'ID' } = options;
    const encodedKeyword = encodeURIComponent(keyword);
    return `https://news.google.com/rss/search?q=${encodedKeyword}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;
}

/**
 * Check if article already exists by URL
 */
async function articleExists(url: string, contentHash: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('content_items')
        .select('id')
        .eq('original_url', url)
        .limit(1);

    if (error) {
        console.error('  ⚠️ Dedup check error:', error.message);
        return false;
    }

    return data && data.length > 0;
}

/**
 * Extract image from RSS item
 */
function extractImage(item: any): string | null {
    if (item.enclosure?.url) return item.enclosure.url;
    if (item['media:content']?.$.url) return item['media:content'].$.url;
    if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;

    // Try to extract from content
    const imgMatch = item.content?.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) return imgMatch[1];

    return null;
}

/**
 * Crawl a single RSS source
 */
export async function crawlSource(source: RssSource): Promise<{ fetched: number; saved: number }> {
    console.log(`📡 Crawling: ${source.name} (${source.url})`);

    try {
        const feed = await parser.parseURL(source.url);
        let fetched = 0;
        let saved = 0;

        console.log(`  📄 Found ${feed.items?.length || 0} items in feed (processing top 5)`);

        // Only process latest 5 items per source to reduce volume
        const itemsToProcess = (feed.items || []).slice(0, 5);

        for (const item of itemsToProcess) {
            if (!item.title || !item.link) {
                console.log(`  ⚠️ Skipping item without title or link`);
                continue;
            }

            fetched++;
            const contentHash = generateContentHash(item.title, item.link);

            // Check if already exists
            const exists = await articleExists(item.link, contentHash);
            if (exists) {
                console.log(`  ⏭️ Duplicate: ${item.title?.substring(0, 40)}...`);
                continue;
            }

            // Check keyword filter
            if (source.keywords && source.keywords.length > 0) {
                const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
                const matches = source.keywords.some(kw => text.includes(kw.toLowerCase()));
                if (!matches) {
                    console.log(`  🔍 Keyword filter: ${item.title?.substring(0, 40)}...`);
                    continue;
                }
            }

            // Check if source_id is a valid UUID (not for temp sources like 'google-news')
            const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.id);

            // Insert new content item
            const { error } = await supabase.from('content_items').insert({
                original_title: item.title.trim(),
                original_desc: item.contentSnippet || item.content || null,
                original_url: item.link.trim(),
                original_image: extractImage(item),
                guid: contentHash,
                source_id: isValidUuid ? source.id : null,
                status: source.auto_generate ? 'incoming' : 'draft',
                platform: 'instagram',
            });

            if (!error) {
                saved++;
                console.log(`  ✅ Saved: ${item.title?.substring(0, 50)}...`);
            } else {
                console.error(`  ❌ Error saving: ${error.message}`);
            }
        }

        // Update last_fetched
        await supabase
            .from('rss_sources')
            .update({ last_fetched: new Date().toISOString() })
            .eq('id', source.id);

        console.log(`  📊 Result: ${fetched} fetched, ${saved} saved`);
        return { fetched, saved };
    } catch (error) {
        console.error(`  ❌ Error crawling ${source.name}:`, error);
        return { fetched: 0, saved: 0 };
    }
}

/**
 * Crawl Google News for a keyword
 */
export async function crawlGoogleNews(
    keyword: string,
    options: { lang?: string; country?: string; sourceId?: string } = {}
): Promise<{ fetched: number; saved: number }> {
    const url = buildGoogleNewsRssUrl(keyword, options);
    console.log(`🔎 Crawling Google News for: "${keyword}"`);

    const tempSource: RssSource = {
        id: options.sourceId || 'google-news',
        name: `Google News: ${keyword}`,
        url,
        is_active: true,
        keywords: [],
        category_filter: [],
        auto_generate: true,
    };

    return crawlSource(tempSource);
}

/**
 * Crawl all active RSS sources
 */
export async function crawlAllSources(): Promise<{ total: number; sources: number; saved: number }> {
    const { data: sources, error } = await supabase
        .from('rss_sources')
        .select('*')
        .eq('is_active', true);

    if (error || !sources) {
        console.error('Error fetching sources:', error);
        return { total: 0, sources: 0, saved: 0 };
    }

    console.log(`\n🚀 Starting RSS crawl for ${sources.length} sources...`);
    console.log('='.repeat(50));

    let totalFetched = 0;
    let totalSaved = 0;

    for (const source of sources) {
        const result = await crawlSource(source as RssSource);
        totalFetched += result.fetched;
        totalSaved += result.saved;

        // Small delay between sources
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('='.repeat(50));
    console.log(`✅ Crawl complete: ${totalFetched} fetched, ${totalSaved} saved from ${sources.length} sources\n`);

    return { total: totalSaved, sources: sources.length, saved: totalSaved };
}
