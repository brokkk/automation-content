import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMRequest, LLMResponse, ContentGenerationResult } from './types';

export async function callGemini(
    request: LLMRequest,
    config: { apiKey: string; model: string }
): Promise<LLMResponse> {
    const startTime = Date.now();

    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({
        model: config.model,
        generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 1000,
            responseMimeType: 'application/json',
        },
    });

    try {
        const result = await model.generateContent([
            { text: request.systemPrompt + '\n\n' + request.userPrompt }
        ]);

        const response = result.response;
        const content = response.text();
        const latencyMs = Date.now() - startTime;

        // Parse JSON response
        let parsed: ContentGenerationResult | undefined;
        try {
            parsed = JSON.parse(content) as ContentGenerationResult;
        } catch {
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]) as ContentGenerationResult;
                } catch {
                    // Still not valid JSON
                }
            }
        }

        // Gemini doesn't provide token counts directly in this SDK version
        return {
            success: true,
            provider: 'gemini',
            model: config.model,
            content,
            parsed,
            usage: {
                inputTokens: 0, // Would need to use countTokens API
                outputTokens: 0,
            },
            latencyMs,
        };
    } catch (error) {
        return {
            success: false,
            provider: 'gemini',
            model: config.model,
            content: '',
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
