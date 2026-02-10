/**
 * AI Article Scorer
 * Scores articles based on viral potential, engagement, shareability, and visual potential
 */

interface ArticleData {
    title: string;
    description?: string;
    url?: string;
    category?: string;
}

export interface ScoreBreakdown {
    viralPotential: number;      // 0-25: Is it trending/newsworthy?
    engagementHooks: number;     // 0-25: Drama, controversy, breaking news?
    shareability: number;        // 0-25: Will people share this?
    visualPotential: number;     // 0-25: Can it become visual content?
    reasoning: string;           // AI explanation
}

export interface ScoringResult {
    score: number;               // 0-100 total score
    breakdown: ScoreBreakdown;
    shouldProcess: boolean;      // Based on threshold
}

const SCORING_PROMPT = `You are a social media content strategist. Analyze this article and score its potential for Instagram/social media content.

Score each category from 0-25:

1. **Viral Potential (0-25)**: Is the topic trending? Breaking news? Hot topic?
2. **Engagement Hooks (0-25)**: Does it have drama, controversy, surprise, emotion?
3. **Shareability (0-25)**: Will people want to share this with friends?
4. **Visual Potential (0-25)**: Can this become compelling visual content?

Output ONLY valid JSON:
{
  "viralPotential": 0-25,
  "engagementHooks": 0-25,
  "shareability": 0-25,
  "visualPotential": 0-25,
  "reasoning": "Brief explanation of the scores"
}

Be strict with scoring. Most articles should score 40-70. Only exceptional content should score 80+.`;

/**
 * Score an article using AI
 */
export async function scoreArticle(
    article: ArticleData,
    config: { apiKey: string; model: string }
): Promise<ScoringResult> {
    const userPrompt = `Analyze this article:

Title: ${article.title}
${article.description ? `Description: ${article.description}` : ''}
${article.category ? `Category: ${article.category}` : ''}
${article.url ? `URL: ${article.url}` : ''}

Score its social media potential.`;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
                'X-Title': 'AI Content Pipeline - Scorer',
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: SCORING_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3, // Lower temp for consistent scoring
                max_tokens: 500,
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('Scoring API error:', data.error);
            return getDefaultScore();
        }

        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Could not parse scoring response:', content);
            return getDefaultScore();
        }

        const breakdown: ScoreBreakdown = JSON.parse(jsonMatch[0]);
        const score = breakdown.viralPotential + breakdown.engagementHooks +
            breakdown.shareability + breakdown.visualPotential;

        // Get threshold from env or default
        const threshold = parseInt(process.env.MIN_SCORE_THRESHOLD || '60');

        return {
            score,
            breakdown,
            shouldProcess: score >= threshold,
        };
    } catch (error) {
        console.error('Scoring failed:', error);
        return getDefaultScore();
    }
}

/**
 * Score multiple articles and return sorted by score
 */
export async function scoreAndRankArticles(
    articles: ArticleData[],
    config: { apiKey: string; model: string },
    limit: number = 5
): Promise<Array<ArticleData & { scoring: ScoringResult }>> {
    console.log(`\n📊 Scoring ${articles.length} articles...`);

    const scored: Array<ArticleData & { scoring: ScoringResult }> = [];

    for (const article of articles) {
        const scoring = await scoreArticle(article, config);
        scored.push({ ...article, scoring });

        console.log(`  ${scoring.score >= 60 ? '✅' : '⚪'} [${scoring.score}] ${article.title.substring(0, 50)}...`);

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Sort by score descending and take top N
    const ranked = scored
        .sort((a, b) => b.scoring.score - a.scoring.score)
        .slice(0, limit);

    console.log(`\n🏆 Top ${limit} articles selected (threshold: ${process.env.MIN_SCORE_THRESHOLD || 60})`);
    ranked.forEach((a, i) => {
        console.log(`  ${i + 1}. [${a.scoring.score}] ${a.title.substring(0, 60)}`);
    });

    return ranked;
}

/**
 * Default score for when AI fails
 */
function getDefaultScore(): ScoringResult {
    return {
        score: 50,
        breakdown: {
            viralPotential: 12,
            engagementHooks: 12,
            shareability: 13,
            visualPotential: 13,
            reasoning: 'Default score - AI scoring failed',
        },
        shouldProcess: false,
    };
}
