// LLM Provider Types
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom';

export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface LLMRequest {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    correlationId?: string;
}

export interface LLMResponse {
    success: boolean;
    provider: LLMProvider;
    model: string;
    content: string;
    parsed?: ContentGenerationResult;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
    latencyMs: number;
    error?: string;
}

// Content Generation Schema
export interface ContentGenerationResult {
    headline: string;
    subheadline: string;
    igCaption: string;
    fbCaption: string;
    variations?: ContentVariation[];
    confidence?: number;
}

export interface ContentVariation {
    headline: string;
    subheadline: string;
    igCaption: string;
    fbCaption: string;
}

// Provider Registry Entry
export interface ProviderEntry {
    id: string;
    provider: LLMProvider;
    name: string;
    model: string;
    isActive: boolean;
    isDefault: boolean;
    priority: number;
}
