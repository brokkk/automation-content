/**
 * Pre-filter Module - Filter articles WITHOUT using AI
 * Reduces LLM calls by filtering at crawl level
 */

export interface PreFilterOptions {
    // Recency filter - only articles newer than X hours
    maxAgeHours?: number;

    // Minimum title length (skip very short/clickbait titles)
    minTitleLength?: number;

    // Required keywords (at least one must match)
    requiredKeywords?: string[];

    // Blocked keywords (skip if any match)
    blockedKeywords?: string[];

    // Blocked sources (domain patterns to skip)
    blockedSources?: string[];

    // Max articles to keep after filtering
    maxArticles?: number;
}

export interface FilteredArticle {
    title: string;
    description?: string;
    url: string;
    image?: string | null;
    pubDate?: Date;
    source?: string;
    matchedKeywords?: string[];
    filterScore?: number; // Simple relevance score without AI
}

const DEFAULT_OPTIONS: PreFilterOptions = {
    maxAgeHours: 48,
    minTitleLength: 20,
    maxArticles: 20,
    blockedKeywords: [
        'sponsored', 'advertisement', 'promo',
        'giveaway', 'undian', 'hadiah',
    ],
    blockedSources: [
        'tribun', 'detik.com/tag', 'grid.id',
    ],
};

/**
 * Calculate simple relevance score (0-100) without AI
 * Based on keyword matching and title quality
 */
function calculateSimpleScore(
    title: string,
    description: string | undefined,
    keywords: string[]
): number {
    let score = 50; // Base score
    const text = `${title} ${description || ''}`.toLowerCase();

    // Boost for keyword matches
    const matchedKeywords: string[] = [];
    for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
            score += 10;
            matchedKeywords.push(keyword);
        }
    }

    // Boost for longer, more descriptive titles
    if (title.length > 50) score += 5;
    if (title.length > 80) score += 5;

    // Boost for having description
    if (description && description.length > 100) score += 10;

    // Penalty for all caps (clickbait)
    if (title === title.toUpperCase()) score -= 20;

    // Cap at 100
    return Math.min(100, Math.max(0, score));
}

/**
 * Pre-filter articles before AI scoring
 */
export function preFilterArticles(
    articles: FilteredArticle[],
    options: PreFilterOptions = {}
): FilteredArticle[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const now = new Date();

    console.log(`\n🔍 Pre-filtering ${articles.length} articles...`);

    let filtered = articles.filter((article) => {
        // 1. Check recency
        if (opts.maxAgeHours && article.pubDate) {
            const ageHours = (now.getTime() - article.pubDate.getTime()) / (1000 * 60 * 60);
            if (ageHours > opts.maxAgeHours) {
                return false;
            }
        }

        // 2. Check minimum title length
        if (opts.minTitleLength && article.title.length < opts.minTitleLength) {
            return false;
        }

        // 3. Check blocked keywords
        if (opts.blockedKeywords) {
            const text = `${article.title} ${article.description || ''}`.toLowerCase();
            for (const blocked of opts.blockedKeywords) {
                if (text.includes(blocked.toLowerCase())) {
                    return false;
                }
            }
        }

        // 4. Check blocked sources
        if (opts.blockedSources && article.url) {
            for (const blocked of opts.blockedSources) {
                if (article.url.toLowerCase().includes(blocked.toLowerCase())) {
                    return false;
                }
            }
        }

        // 5. Check required keywords (if specified)
        if (opts.requiredKeywords && opts.requiredKeywords.length > 0) {
            const text = `${article.title} ${article.description || ''}`.toLowerCase();
            const hasMatch = opts.requiredKeywords.some(kw =>
                text.includes(kw.toLowerCase())
            );
            if (!hasMatch) {
                return false;
            }
        }

        return true;
    });

    // Calculate simple scores
    filtered = filtered.map((article) => ({
        ...article,
        filterScore: calculateSimpleScore(
            article.title,
            article.description,
            opts.requiredKeywords || []
        ),
    }));

    // Sort by score and limit
    filtered.sort((a, b) => (b.filterScore || 0) - (a.filterScore || 0));

    if (opts.maxArticles) {
        filtered = filtered.slice(0, opts.maxArticles);
    }

    console.log(`  ✅ Kept ${filtered.length} articles after pre-filter`);

    return filtered;
}

/**
 * Quick check if article is likely high quality (for skipping AI scoring)
 */
export function isLikelyHighQuality(article: FilteredArticle): boolean {
    const title = article.title.toLowerCase();

    // High-value indicators
    const highValuePatterns = [
        /funding|raised|investment/i,
        /launch|unveil|announce/i,
        /acquire|merger|acquisition/i,
        /milestone|breakthrough|first/i,
        /exclusive|interview|insight/i,
    ];

    for (const pattern of highValuePatterns) {
        if (pattern.test(title)) {
            return true;
        }
    }

    return false;
}
