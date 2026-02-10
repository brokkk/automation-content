import type { LLMProvider, LLMRequest, LLMResponse, ContentGenerationResult } from './types';
import { callOpenAI } from './providers/openai';
import { callAnthropic } from './providers/anthropic';
import { callGemini } from './providers/gemini';

// Environment-based API keys
const API_KEYS: Record<LLMProvider, string | undefined> = {
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
    gemini: import.meta.env.VITE_GEMINI_API_KEY,
    xai: import.meta.env.VITE_XAI_API_KEY,
    openrouter: import.meta.env.VITE_OPENROUTER_API_KEY,
    custom: undefined,
};

// Default models per provider
const DEFAULT_MODELS: Record<LLMProvider, string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-2.0-flash-exp',
    xai: 'grok-2',
    openrouter: 'openai/gpt-4o',
    custom: '',
};

// Provider priority for fallback (openrouter first for free models)
const PROVIDER_PRIORITY: LLMProvider[] = ['openrouter', 'gemini', 'openai', 'anthropic'];

interface GenerateOptions {
    provider?: LLMProvider;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableFallback?: boolean;
    correlationId?: string;
}

/**
 * Generate content using the specified provider or fallback chain
 */
export async function generate(
    request: LLMRequest,
    options: GenerateOptions = {}
): Promise<LLMResponse> {
    const {
        provider: preferredProvider,
        model,
        enableFallback = true,
    } = options;

    // Build provider chain
    const providerChain = preferredProvider
        ? [preferredProvider, ...PROVIDER_PRIORITY.filter(p => p !== preferredProvider)]
        : PROVIDER_PRIORITY;

    // Try each provider in order if fallback is enabled
    const providers = enableFallback ? providerChain : [providerChain[0]];

    for (const provider of providers) {
        const apiKey = API_KEYS[provider];
        if (!apiKey) continue;

        const providerModel = model || DEFAULT_MODELS[provider];
        const response = await callProvider(provider, request, {
            apiKey,
            model: providerModel,
        });

        if (response.success) {
            return response;
        }

        // Log error but continue to next provider
        console.warn(`[LLM] ${provider} failed:`, response.error);
    }

    // All providers failed
    return {
        success: false,
        provider: providers[0] || 'openai',
        model: model || DEFAULT_MODELS[providers[0] || 'openai'],
        content: '',
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: 0,
        error: 'All providers failed',
    };
}

/**
 * Call specific provider
 */
async function callProvider(
    provider: LLMProvider,
    request: LLMRequest,
    config: { apiKey: string; model: string; baseUrl?: string }
): Promise<LLMResponse> {
    switch (provider) {
        case 'openai':
        case 'xai': // xAI uses OpenAI-compatible API
        case 'openrouter': // OpenRouter uses OpenAI-compatible API
            return callOpenAI(request, {
                ...config,
                baseUrl: provider === 'xai'
                    ? 'https://api.x.ai/v1'
                    : provider === 'openrouter'
                        ? 'https://openrouter.ai/api/v1'
                        : undefined,
            });
        case 'anthropic':
            return callAnthropic(request, config);
        case 'gemini':
            return callGemini(request, config);
        default:
            return {
                success: false,
                provider,
                model: config.model,
                content: '',
                usage: { inputTokens: 0, outputTokens: 0 },
                latencyMs: 0,
                error: `Unsupported provider: ${provider}`,
            };
    }
}

/**
 * Generate social media content from article data
 */
export async function generateContent(
    article: {
        title: string;
        description?: string;
        url: string;
        category?: string;
    },
    options: GenerateOptions = {}
): Promise<ContentGenerationResult | null> {
    const systemPrompt = CONTENT_GENERATION_SYSTEM_PROMPT;
    const userPrompt = buildContentPrompt(article);

    const response = await generate(
        { systemPrompt, userPrompt, ...options },
        options
    );

    if (response.success && response.parsed) {
        return response.parsed;
    }

    return null;
}

/**
 * System prompt for content generation
 */
const CONTENT_GENERATION_SYSTEM_PROMPT = `You are a professional social media content writer. Your task is to transform news articles into engaging social media posts.

Output ONLY valid JSON in this exact format:
{
  "headline": "Catchy headline for the post (max 60 chars)",
  "subheadline": "Supporting text that adds context (max 120 chars)",
  "igCaption": "Instagram caption with emojis, line breaks, hashtags (max 2000 chars)",
  "fbCaption": "Facebook caption, more conversational, can include link text (max 500 chars)",
  "confidence": 0.95
}

Guidelines:
- Use emojis strategically in Instagram captions
- Include 5-10 relevant hashtags for Instagram
- Make the headline punchy and attention-grabbing
- The subheadline should provide additional value
- Facebook captions should be more conversational
- confidence should be 0.0-1.0 based on how well the content fits social media`;

/**
 * Build user prompt for content generation
 */
function buildContentPrompt(article: {
    title: string;
    description?: string;
    url: string;
    category?: string;
}): string {
    return `Create social media content for this article:

Title: ${article.title}
${article.description ? `Description: ${article.description}` : ''}
${article.category ? `Category: ${article.category}` : ''}
URL: ${article.url}

Generate engaging Instagram and Facebook captions that will drive engagement. Remember to output valid JSON only.`;
}

// Re-export types
export type { LLMProvider, LLMRequest, LLMResponse, ContentGenerationResult } from './types';
