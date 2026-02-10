export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            categories: {
                Row: {
                    id: string
                    name: string
                    slug: string
                    color: string
                    rules: Json
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    slug: string
                    color?: string
                    rules?: Json
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    slug?: string
                    color?: string
                    rules?: Json
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            rss_sources: {
                Row: {
                    id: string
                    name: string
                    url: string
                    favicon: string | null
                    category_id: string | null
                    is_active: boolean
                    fetch_interval: number
                    last_fetched: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    url: string
                    favicon?: string | null
                    category_id?: string | null
                    is_active?: boolean
                    fetch_interval?: number
                    last_fetched?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    url?: string
                    favicon?: string | null
                    category_id?: string | null
                    is_active?: boolean
                    fetch_interval?: number
                    last_fetched?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            personas: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    tone: string | null
                    prompt_template: string
                    is_default: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    tone?: string | null
                    prompt_template: string
                    is_default?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    tone?: string | null
                    prompt_template?: string
                    is_default?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            llm_providers: {
                Row: {
                    id: string
                    provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom'
                    name: string
                    base_url: string | null
                    default_model: string
                    fallback_model: string | null
                    is_active: boolean
                    is_default: boolean
                    priority: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom'
                    name: string
                    base_url?: string | null
                    default_model: string
                    fallback_model?: string | null
                    is_active?: boolean
                    is_default?: boolean
                    priority?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    provider?: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom'
                    name?: string
                    base_url?: string | null
                    default_model?: string
                    fallback_model?: string | null
                    is_active?: boolean
                    is_default?: boolean
                    priority?: number
                    created_at?: string
                    updated_at?: string
                }
            }
            content_items: {
                Row: {
                    id: string
                    source_id: string | null
                    category_id: string | null
                    persona_id: string | null
                    original_title: string
                    original_desc: string | null
                    original_url: string
                    original_image: string | null
                    guid: string | null
                    headline: string | null
                    subheadline: string | null
                    ig_caption: string | null
                    fb_caption: string | null
                    variations: Json
                    ai_confidence: number | null
                    selected_var: number
                    status: 'incoming' | 'ai_generated' | 'draft' | 'waiting_approval' | 'approved' | 'scheduled' | 'published' | 'rejected' | 'failed'
                    platform: 'instagram' | 'facebook' | 'both'
                    scheduled_at: string | null
                    published_at: string | null
                    llm_run_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    source_id?: string | null
                    category_id?: string | null
                    persona_id?: string | null
                    original_title: string
                    original_desc?: string | null
                    original_url: string
                    original_image?: string | null
                    guid?: string | null
                    headline?: string | null
                    subheadline?: string | null
                    ig_caption?: string | null
                    fb_caption?: string | null
                    variations?: Json
                    ai_confidence?: number | null
                    selected_var?: number
                    status?: 'incoming' | 'ai_generated' | 'draft' | 'waiting_approval' | 'approved' | 'scheduled' | 'published' | 'rejected' | 'failed'
                    platform?: 'instagram' | 'facebook' | 'both'
                    scheduled_at?: string | null
                    published_at?: string | null
                    llm_run_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    source_id?: string | null
                    category_id?: string | null
                    persona_id?: string | null
                    original_title?: string
                    original_desc?: string | null
                    original_url?: string
                    original_image?: string | null
                    guid?: string | null
                    headline?: string | null
                    subheadline?: string | null
                    ig_caption?: string | null
                    fb_caption?: string | null
                    variations?: Json
                    ai_confidence?: number | null
                    selected_var?: number
                    status?: 'incoming' | 'ai_generated' | 'draft' | 'waiting_approval' | 'approved' | 'scheduled' | 'published' | 'rejected' | 'failed'
                    platform?: 'instagram' | 'facebook' | 'both'
                    scheduled_at?: string | null
                    published_at?: string | null
                    llm_run_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            media_assets: {
                Row: {
                    id: string
                    content_id: string
                    type: string
                    format: string
                    storage_path: string
                    public_url: string | null
                    template_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    content_id: string
                    type: string
                    format: string
                    storage_path: string
                    public_url?: string | null
                    template_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    content_id?: string
                    type?: string
                    format?: string
                    storage_path?: string
                    public_url?: string | null
                    template_id?: string | null
                    created_at?: string
                }
            }
            approval_logs: {
                Row: {
                    id: string
                    content_id: string
                    token: string
                    token_expires: string
                    action: string | null
                    approved_by: string | null
                    ip_address: string | null
                    notes: string | null
                    created_at: string
                    actioned_at: string | null
                }
                Insert: {
                    id?: string
                    content_id: string
                    token: string
                    token_expires: string
                    action?: string | null
                    approved_by?: string | null
                    ip_address?: string | null
                    notes?: string | null
                    created_at?: string
                    actioned_at?: string | null
                }
                Update: {
                    id?: string
                    content_id?: string
                    token?: string
                    token_expires?: string
                    action?: string | null
                    approved_by?: string | null
                    ip_address?: string | null
                    notes?: string | null
                    created_at?: string
                    actioned_at?: string | null
                }
            }
            llm_runs: {
                Row: {
                    id: string
                    provider_id: string | null
                    provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom'
                    model: string
                    prompt_hash: string
                    correlation_id: string
                    system_prompt: string | null
                    user_prompt: string
                    response_raw: string | null
                    response_parsed: Json | null
                    validation_status: string | null
                    input_tokens: number | null
                    output_tokens: number | null
                    latency_ms: number | null
                    status: string
                    error_message: string | null
                    content_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    provider_id?: string | null
                    provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom'
                    model: string
                    prompt_hash: string
                    correlation_id: string
                    system_prompt?: string | null
                    user_prompt: string
                    response_raw?: string | null
                    response_parsed?: Json | null
                    validation_status?: string | null
                    input_tokens?: number | null
                    output_tokens?: number | null
                    latency_ms?: number | null
                    status?: string
                    error_message?: string | null
                    content_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    provider_id?: string | null
                    provider?: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom'
                    model?: string
                    prompt_hash?: string
                    correlation_id?: string
                    system_prompt?: string | null
                    user_prompt?: string
                    response_raw?: string | null
                    response_parsed?: Json | null
                    validation_status?: string | null
                    input_tokens?: number | null
                    output_tokens?: number | null
                    latency_ms?: number | null
                    status?: string
                    error_message?: string | null
                    content_id?: string | null
                    created_at?: string
                }
            }
            workflow_runs: {
                Row: {
                    id: string
                    workflow_name: string
                    trigger_type: string
                    correlation_id: string
                    status: string
                    input_data: Json | null
                    output_data: Json | null
                    error_log: string | null
                    retry_count: number
                    started_at: string | null
                    completed_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    workflow_name: string
                    trigger_type: string
                    correlation_id: string
                    status?: string
                    input_data?: Json | null
                    output_data?: Json | null
                    error_log?: string | null
                    retry_count?: number
                    started_at?: string | null
                    completed_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    workflow_name?: string
                    trigger_type?: string
                    correlation_id?: string
                    status?: string
                    input_data?: Json | null
                    output_data?: Json | null
                    error_log?: string | null
                    retry_count?: number
                    started_at?: string | null
                    completed_at?: string | null
                    created_at?: string
                }
            }
            publish_logs: {
                Row: {
                    id: string
                    content_id: string | null
                    platform: 'instagram' | 'facebook' | 'both'
                    external_id: string | null
                    buffer_id: string | null
                    status: string
                    response_data: Json | null
                    published_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    content_id?: string | null
                    platform: 'instagram' | 'facebook' | 'both'
                    external_id?: string | null
                    buffer_id?: string | null
                    status: string
                    response_data?: Json | null
                    published_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    content_id?: string | null
                    platform?: 'instagram' | 'facebook' | 'both'
                    external_id?: string | null
                    buffer_id?: string | null
                    status?: string
                    response_data?: Json | null
                    published_at?: string | null
                    created_at?: string
                }
            }
            system_events: {
                Row: {
                    id: string
                    event_type: string
                    severity: string
                    correlation_id: string | null
                    source: string
                    message: string
                    metadata: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    event_type: string
                    severity: string
                    correlation_id?: string | null
                    source: string
                    message: string
                    metadata?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    event_type?: string
                    severity?: string
                    correlation_id?: string | null
                    source?: string
                    message?: string
                    metadata?: Json
                    created_at?: string
                }
            }
            image_templates: {
                Row: {
                    id: string
                    name: string
                    slug: string
                    html_content: string
                    supported_formats: string[]
                    category_id: string | null
                    is_default: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    slug: string
                    html_content: string
                    supported_formats?: string[]
                    category_id?: string | null
                    is_default?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    slug?: string
                    html_content?: string
                    supported_formats?: string[]
                    category_id?: string | null
                    is_default?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            content_status: 'incoming' | 'ai_generated' | 'draft' | 'waiting_approval' | 'approved' | 'scheduled' | 'published' | 'rejected' | 'failed'
            platform_type: 'instagram' | 'facebook' | 'both'
            llm_provider_type: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'custom'
        }
    }
}
