import Anthropic from '@anthropic-ai/sdk';
import type { LLMRequest, LLMResponse, ContentGenerationResult } from './types';

export async function callAnthropic(
    request: LLMRequest,
    config: { apiKey: string; model: string }
): Promise<LLMResponse> {
    const startTime = Date.now();

    const client = new Anthropic({
        apiKey: config.apiKey,
    });

    try {
        const response = await client.messages.create({
            model: config.model,
            max_tokens: request.maxTokens ?? 1000,
            system: request.systemPrompt,
            messages: [
                { role: 'user', content: request.userPrompt },
            ],
        });

        const textBlock = response.content.find((block) => block.type === 'text');
        const content = textBlock?.type === 'text' ? textBlock.text : '';
        const latencyMs = Date.now() - startTime;

        // Parse JSON response
        let parsed: ContentGenerationResult | undefined;
        try {
            // Extract JSON from potential markdown code blocks
            const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            parsed = JSON.parse(jsonStr) as ContentGenerationResult;
        } catch {
            // Content is not valid JSON
        }

        return {
            success: true,
            provider: 'anthropic',
            model: config.model,
            content,
            parsed,
            usage: {
                inputTokens: response.usage?.input_tokens || 0,
                outputTokens: response.usage?.output_tokens || 0,
            },
            latencyMs,
        };
    } catch (error) {
        return {
            success: false,
            provider: 'anthropic',
            model: config.model,
            content: '',
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
