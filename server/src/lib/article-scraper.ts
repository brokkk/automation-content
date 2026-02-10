/**
 * Full Article Scraper
 * Extracts main article content from URLs
 */

import * as cheerio from 'cheerio';

export interface ScrapedArticle {
    title: string;
    content: string;          // Full article text
    excerpt: string;          // First 500 chars
    author?: string;
    publishDate?: string;
    imageUrl?: string;
    wordCount: number;
}

/**
 * Scrape full article content from URL
 */
export async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
    try {
        console.log(`🔍 Scraping: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        if (!response.ok) {
            console.error(`Failed to fetch: ${response.status}`);
            return null;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('script, style, nav, header, footer, aside, .ads, .advertisement, .social-share, .comments, .related-articles').remove();

        // Try to find article content with common selectors
        const articleSelectors = [
            'article',
            '[role="main"]',
            '.article-content',
            '.post-content',
            '.entry-content',
            '.content-body',
            '.article-body',
            '.story-body',
            'main',
            '.main-content',
        ];

        let content = '';
        let $article: cheerio.Cheerio<any> | null = null;

        for (const selector of articleSelectors) {
            const $candidate = $(selector);
            if ($candidate.length > 0) {
                $article = $candidate.first();
                break;
            }
        }

        if ($article) {
            // Get text from paragraphs
            const paragraphs: string[] = [];
            $article.find('p').each((_, el) => {
                const text = $(el).text().trim();
                if (text.length > 30) { // Filter short paragraphs
                    paragraphs.push(text);
                }
            });
            content = paragraphs.join('\n\n');
        }

        // Fallback: get all paragraphs from body
        if (!content || content.length < 200) {
            const paragraphs: string[] = [];
            $('body p').each((_, el) => {
                const text = $(el).text().trim();
                if (text.length > 50) {
                    paragraphs.push(text);
                }
            });
            content = paragraphs.slice(0, 20).join('\n\n'); // Limit to first 20 paragraphs
        }

        // Get title
        const title = $('h1').first().text().trim() ||
            $('meta[property="og:title"]').attr('content') ||
            $('title').text().trim() ||
            'Untitled';

        // Get author
        const author = $('[rel="author"]').first().text().trim() ||
            $('meta[name="author"]').attr('content') ||
            $('.author').first().text().trim();

        // Get publish date
        const publishDate = $('meta[property="article:published_time"]').attr('content') ||
            $('time').first().attr('datetime') ||
            $('meta[name="date"]').attr('content');

        // Get image
        const imageUrl = $('meta[property="og:image"]').attr('content') ||
            $('article img').first().attr('src');

        // Clean up content
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        const wordCount = content.split(/\s+/).length;

        console.log(`  ✅ Scraped ${wordCount} words`);

        return {
            title: cleanText(title),
            content: content.substring(0, 10000), // Limit to 10k chars
            excerpt: content.substring(0, 500),
            author: author ? cleanText(author) : undefined,
            publishDate,
            imageUrl,
            wordCount,
        };
    } catch (error) {
        console.error(`❌ Scraping failed for ${url}:`, error);
        return null;
    }
}

/**
 * Clean text by removing extra whitespace and special chars
 */
function cleanText(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width chars
        .trim();
}

/**
 * Scrape multiple articles
 */
export async function scrapeArticles(
    urls: string[]
): Promise<Map<string, ScrapedArticle | null>> {
    const results = new Map<string, ScrapedArticle | null>();

    for (const url of urls) {
        const article = await scrapeArticle(url);
        results.set(url, article);

        // Delay between requests to be polite
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
}
