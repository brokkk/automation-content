/**
 * Image Scraper - Extract og:image from article URLs
 */

export interface ScrapedContent {
    imageUrl: string | null;
    articleText: string | null;
    finalUrl?: string;
}

/**
 * Decode Google News RSS URL to get actual article URL
 * Google News encodes the real URL in base64 within the RSS link
 */
function decodeGoogleNewsUrl(url: string): string | null {
    try {
        // Extract the encoded part after /articles/
        const match = url.match(/\/articles\/([A-Za-z0-9_-]+)/);
        if (!match) return null;

        let encoded = match[1];

        // Replace URL-safe base64 chars with standard base64 chars
        encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');

        // Add padding if needed
        const padding = encoded.length % 4;
        if (padding) {
            encoded += '='.repeat(4 - padding);
        }

        // Decode base64
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

        // Find URL in decoded string (it's usually after some binary data)
        const urlMatch = decoded.match(/https?:\/\/[^\s"<>]+/);
        if (urlMatch) {
            // Clean up the URL
            let articleUrl = urlMatch[0];
            // Remove any trailing garbage characters
            articleUrl = articleUrl.replace(/[\x00-\x1F\x7F-\xFF]+.*$/, '');
            return articleUrl;
        }

        return null;
    } catch (error) {
        console.log(`  ⚠️ Google News decode error:`, (error as Error).message);
        return null;
    }
}

/**
 * Follow redirects and get final URL (especially for Google News)
 */
async function followRedirects(url: string): Promise<string> {
    // First try to decode Google News URL directly (faster)
    if (url.includes('news.google.com/rss/articles/')) {
        const decodedUrl = decodeGoogleNewsUrl(url);
        if (decodedUrl) {
            console.log(`  ✅ Decoded Google News URL: ${decodedUrl.substring(0, 60)}...`);
            return decodedUrl;
        }
    }

    try {
        // Fallback: fetch the page and look for redirects
        const response = await fetch(url, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000),
        });

        const html = await response.text();

        // Try to extract from data-n-au attribute
        const dataMatch = html.match(/data-n-au="([^"]+)"/);
        if (dataMatch && dataMatch[1]) {
            console.log(`  ✅ Found article URL in data-n-au`);
            return dataMatch[1];
        }

        // Try canonical link
        const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
        if (canonicalMatch && canonicalMatch[1] && !canonicalMatch[1].includes('google.com')) {
            return canonicalMatch[1];
        }

        // Check response URL
        if (response.url && !response.url.includes('google.com')) {
            return response.url;
        }

        return url;
    } catch (error) {
        console.log(`  ⚠️ Redirect follow error:`, (error as Error).message);
        return url;
    }
}

/**
 * Scrape og:image and article text from article URL
 */
export async function scrapeArticleContent(url: string): Promise<ScrapedContent> {
    try {
        // Follow Google News redirects to get actual article URL
        let finalUrl = url;
        if (url.includes('news.google.com') || url.includes('google.com/rss')) {
            console.log(`  🔗 Following Google News redirect...`);
            finalUrl = await followRedirects(url);
            console.log(`  📍 Final URL: ${finalUrl.substring(0, 60)}...`);
        }

        console.log(`  🔍 Scraping content from: ${finalUrl.substring(0, 50)}...`);

        const response = await fetch(finalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            console.log(`  ⚠️ Failed to fetch article: ${response.status}`);
            return { imageUrl: null, articleText: null, finalUrl };
        }

        const html = await response.text();

        // Extract og:image
        let imageUrl: string | null = null;
        let match = html.match(/<meta\s+(?:[^>]*\s+)?property=["']og:image["']\s+(?:[^>]*\s+)?content=["']([^"']+)["']/i);
        if (!match) {
            match = html.match(/<meta\s+(?:[^>]*\s+)?content=["']([^"']+)["']\s+(?:[^>]*\s+)?property=["']og:image["']/i);
        }
        if (match && match[1] && match[1].startsWith('http')) {
            imageUrl = match[1];
            console.log(`  ✅ Found og:image: ${imageUrl.substring(0, 60)}...`);
        }

        // Extract article text
        let articleText: string | null = null;

        // Remove scripts, styles, and nav elements
        let cleanHtml = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

        // Try to find article content
        const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        if (articleMatch) {
            cleanHtml = articleMatch[1];
        } else {
            // Try main content
            const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
            if (mainMatch) {
                cleanHtml = mainMatch[1];
            }
        }

        // Extract paragraph text
        const paragraphs: string[] = [];
        const pMatches = cleanHtml.matchAll(/<p[^>]*>([^<]+(?:<[^/][^>]*>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi);

        for (const pMatch of pMatches) {
            // Strip remaining HTML tags
            const text = pMatch[1]
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim();

            if (text.length > 50) { // Only meaningful paragraphs
                paragraphs.push(text);
            }
        }

        if (paragraphs.length > 0) {
            // Take first 5 paragraphs (usually enough for context)
            articleText = paragraphs.slice(0, 5).join('\n\n');
            console.log(`  ✅ Extracted ${paragraphs.length} paragraphs (${articleText.length} chars)`);
        }

        return { imageUrl, articleText, finalUrl };
    } catch (error) {
        console.log(`  ⚠️ Scrape error: ${(error as Error).message}`);
        return { imageUrl: null, articleText: null };
    }
}

/**
 * Scrape og:image only (backward compatible)
 */
export async function scrapeArticleImage(url: string): Promise<string | null> {
    const result = await scrapeArticleContent(url);
    return result.imageUrl;
}

/**
 * Batch scrape images for articles without images
 */
export async function scrapeImagesForArticles(
    articles: Array<{ id: string; original_url: string; original_image: string | null }>
): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const article of articles) {
        if (!article.original_image && article.original_url) {
            const imageUrl = await scrapeArticleImage(article.original_url);
            if (imageUrl) {
                results.set(article.id, imageUrl);
            }
            // Small delay to be polite to servers
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return results;
}
