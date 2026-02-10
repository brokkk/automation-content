/**
 * Auto Curation System
 * Fully automated content selection without manual intervention
 * 
 * Flow: 881 articles → Pre-filter → Score → Top N per category → Auto Generate
 */

import { supabase, type ContentItem } from './supabase.js';

export interface CurationConfig {
    maxPerCategory: number;      // Max articles to select per category
    maxTotal: number;            // Max total articles to process
    minTitleLength: number;      // Minimum title length
    maxAgeHours: number;         // Maximum article age in hours
    blockedKeywords: string[];   // Keywords to filter out
    boostKeywords: string[];     // Keywords that increase score
}

const DEFAULT_CONFIG: CurationConfig = {
    maxPerCategory: 3,           // 3 per category = 15-18 total
    maxTotal: 15,                // Max 15 per run
    minTitleLength: 25,
    maxAgeHours: 48,
    blockedKeywords: [
        'sponsored', 'promo', 'iklan', 'advertisement', 'ad:', '[ad]',
        'press release', 'siaran pers', 'giveaway', 'discount', 'diskon'
    ],
    boostKeywords: [
        // Fashion
        'streetwear', 'sneaker', 'nike', 'adidas', 'fashion week', 'collaboration',
        'collection', 'drop', 'release', 'limited', 'exclusive',
        // Food
        'michelin', 'restaurant', 'cafe', 'kuliner', 'viral', 'trending',
        'baru buka', 'new opening', 'review',
        // Design
        'interior', 'architecture', 'design', 'minimalist', 'modern',
        // Travel  
        'hidden gem', 'destinasi', 'travel', 'liburan', 'aesthetic',
        // General engagement
        'terbaik', 'best', 'top', 'guide', 'tips', '2024', '2025'
    ],
};

/**
 * Calculate relevance score for an article (0-100)
 * Higher score = more likely to be selected
 */
export function calculateRelevanceScore(article: {
    title: string;
    description?: string;
    createdAt?: string;
}): number {
    let score = 50; // Base score

    const title = article.title.toLowerCase();
    const desc = (article.description || '').toLowerCase();
    const combined = `${title} ${desc}`;

    // Boost for keywords
    for (const keyword of DEFAULT_CONFIG.boostKeywords) {
        if (combined.includes(keyword.toLowerCase())) {
            score += 8;
        }
    }

    // Penalty for blocked keywords
    for (const keyword of DEFAULT_CONFIG.blockedKeywords) {
        if (combined.includes(keyword.toLowerCase())) {
            score -= 30;
        }
    }

    // Boost for longer, more descriptive titles
    if (title.length > 60) score += 5;
    if (title.length > 80) score += 5;

    // Boost for having description
    if (desc.length > 100) score += 10;

    // Boost for questions (engaging)
    if (title.includes('?')) score += 5;

    // Boost for numbers (lists, rankings)
    if (/\d+/.test(title)) score += 5;

    // Penalty for ALL CAPS (clickbait)
    if (title === title.toUpperCase() && title.length > 10) score -= 15;

    // Recency boost
    if (article.createdAt) {
        const ageHours = (Date.now() - new Date(article.createdAt).getTime()) / (1000 * 60 * 60);
        if (ageHours < 6) score += 15;
        else if (ageHours < 12) score += 10;
        else if (ageHours < 24) score += 5;
        else if (ageHours > 48) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Auto-curate articles from incoming items
 * Returns selected article IDs ready for content generation
 */
export async function autoCurateArticles(
    config: Partial<CurationConfig> = {}
): Promise<ContentItem[]> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    console.log('\n🤖 AUTO CURATION STARTING...\n');
    console.log(`Config: ${cfg.maxPerCategory}/category, ${cfg.maxTotal} max total`);

    // Get all incoming articles
    const { data: allItems, error } = await supabase
        .from('content_items')
        .select(`
      *,
      source:rss_sources(id, name, category_id),
      category:categories(id, name, slug)
    `)
        .eq('status', 'incoming')
        .order('created_at', { ascending: false });

    if (error || !allItems) {
        console.error('Failed to fetch articles:', error);
        return [];
    }

    console.log(`📥 Found ${allItems.length} incoming articles`);

    // Step 1: Pre-filter
    const filtered = allItems.filter(item => {
        const title = item.original_title || '';
        const combined = `${title} ${item.original_desc || ''}`.toLowerCase();

        // Min title length
        if (title.length < cfg.minTitleLength) return false;

        // Max age
        if (item.created_at) {
            const ageHours = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
            if (ageHours > cfg.maxAgeHours) return false;
        }

        // Blocked keywords
        for (const kw of cfg.blockedKeywords) {
            if (combined.includes(kw.toLowerCase())) return false;
        }

        return true;
    });

    console.log(`🔍 After pre-filter: ${filtered.length} articles`);

    // Step 2: Score all articles
    const scored = filtered.map(item => ({
        ...item,
        relevanceScore: calculateRelevanceScore({
            title: item.original_title || '',
            description: item.original_desc || '',
            createdAt: item.created_at,
        }),
    }));

    // Step 3: Group by category and select top N per category
    const byCategory = new Map<string, typeof scored>();

    for (const item of scored) {
        const catName = item.source?.category_id
            ? (item.category?.name || 'Uncategorized')
            : 'Uncategorized';

        if (!byCategory.has(catName)) {
            byCategory.set(catName, []);
        }
        byCategory.get(catName)!.push(item);
    }

    // Sort each category by score and pick top N
    const selected: typeof scored = [];

    for (const [catName, items] of byCategory) {
        const sorted = items.sort((a, b) => b.relevanceScore - a.relevanceScore);
        const topN = sorted.slice(0, cfg.maxPerCategory);

        console.log(`\n📂 ${catName}: ${items.length} total → picking top ${topN.length}`);
        for (const item of topN) {
            console.log(`   [${item.relevanceScore}] ${(item.original_title || '').substring(0, 50)}...`);
        }

        selected.push(...topN);
    }

    // Sort by score and limit to maxTotal
    const final = selected
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, cfg.maxTotal);

    console.log(`\n✅ SELECTED: ${final.length} articles for content generation`);

    return final as ContentItem[];
}

/**
 * Full auto pipeline: Curate → Generate → Ready for approval
 */
export async function runAutoPipeline(
    config: Partial<CurationConfig> = {}
): Promise<{ curated: number; generated: number }> {
    // Import batch generator
    const { processArticlesOptimized } = await import('./batch-generator.js');

    // Step 1: Auto curate
    const selected = await autoCurateArticles(config);

    if (selected.length === 0) {
        console.log('\n⚠️ No articles selected for processing');
        return { curated: 0, generated: 0 };
    }

    // Step 2: Generate content for selected articles
    console.log(`\n🚀 Generating content for ${selected.length} articles...`);
    const generated = await processArticlesOptimized(selected as any);

    console.log('\n' + '='.repeat(50));
    console.log(`✅ AUTO PIPELINE COMPLETE`);
    console.log(`   Curated: ${selected.length}`);
    console.log(`   Generated: ${generated}`);
    console.log('='.repeat(50));

    return { curated: selected.length, generated };
}
