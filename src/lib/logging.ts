import { supabase } from './supabase';

// ============================================
// System Event Logging
// ============================================

export type EventSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type EventType =
    | 'CONTENT_CREATED'
    | 'CONTENT_UPDATED'
    | 'AI_GENERATION_STARTED'
    | 'AI_GENERATION_COMPLETED'
    | 'AI_GENERATION_FAILED'
    | 'APPROVAL_REQUESTED'
    | 'APPROVAL_COMPLETED'
    | 'APPROVAL_REJECTED'
    | 'APPROVAL_EXPIRED'
    | 'PUBLISH_STARTED'
    | 'PUBLISH_COMPLETED'
    | 'PUBLISH_FAILED'
    | 'IMAGE_GENERATED'
    | 'RSS_FETCHED'
    | 'SYSTEM_ERROR'
    | 'API_ERROR';

interface LogOptions {
    contentId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Log a system event
 */
export async function logEvent(
    eventType: EventType,
    severity: EventSeverity,
    message: string,
    options: LogOptions = {}
): Promise<void> {
    try {
        await supabase.from('system_events').insert({
            event_type: eventType,
            severity,
            source: 'app',
            message,
            content_id: options.contentId,
            user_id: options.userId,
            metadata: options.metadata,
        });
    } catch (error) {
        console.error('Failed to log event:', error);
    }
}

/**
 * Log info level event
 */
export function logInfo(eventType: EventType, message: string, options?: LogOptions) {
    return logEvent(eventType, 'INFO', message, options);
}

/**
 * Log warning level event
 */
export function logWarning(eventType: EventType, message: string, options?: LogOptions) {
    return logEvent(eventType, 'WARNING', message, options);
}

/**
 * Log error level event
 */
export function logError(eventType: EventType, message: string, options?: LogOptions) {
    return logEvent(eventType, 'ERROR', message, options);
}

/**
 * Get recent system events
 */
export async function getRecentEvents(
    limit = 50,
    severity?: EventSeverity
): Promise<Database['public']['Tables']['system_events']['Row'][]> {
    let query = supabase
        .from('system_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (severity) {
        query = query.eq('severity', severity);
    }

    const { data } = await query;
    return data || [];
}

/**
 * Get events for a specific content item
 */
export async function getContentEvents(contentId: string) {
    const { data } = await supabase
        .from('system_events')
        .select('*')
        .eq('content_id', contentId)
        .order('created_at', { ascending: false });

    return data || [];
}

// Type import for return type
import type { Database } from './database.types';
