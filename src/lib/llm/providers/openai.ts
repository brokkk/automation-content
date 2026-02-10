import OpenAI from 'openai';
import type { LLMRequest, LLMResponse, ContentGenerationResult } from './types';

export async function callOpenAI(
    request: LLMRequest,
    config: { apiKey: string; model: string; baseUrl?: string }
): Promise<LLMResponse> {
    const startTime = Date.now();

    const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        dangerouslyAllowBrowser: true, // For client-side calls (use server in production)
    });

    try {
        const response = await client.chat.completions.create({
            model: config.model,
            messages: [
                { role: 'system', content: request.systemPrompt },
                { role: 'user', content: request.userPrompt },
            ],
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 1000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content || '';
        const latencyMs = Date.now() - startTime;

        // Parse JSON response
        let parsed: ContentGenerationResult | undefined;
        try {
            parsed = JSON.parse(content) as ContentGenerationResult;
        } catch {
            // Content is not valid JSON
        }

        return {
            success: true,
            provider: 'openai',
            model: config.model,
            content,
            parsed,
            usage: {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
            },
            latencyMs,
        };
    } catch (error) {
        return {
            success: false,
            provider: 'openai',
            model: config.model,
            content: '',
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
