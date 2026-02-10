import { supabase } from './supabase';
import type { Database } from './database.types';

type ContentItem = Database['public']['Tables']['content_items']['Row'];
type ContentItemInsert = Database['public']['Tables']['content_items']['Insert'];
type ContentItemUpdate = Database['public']['Tables']['content_items']['Update'];
type Category = Database['public']['Tables']['categories']['Row'];
type RssSource = Database['public']['Tables']['rss_sources']['Row'];

// ============================================
// Content Items
// ============================================

export async function getContentItems() {
    // Fetch per-status to avoid Supabase 1000 row limit hiding important items
    const statuses = ['incoming', 'ai_generated', 'waiting_approval', 'approved', 'scheduled', 'published', 'rejected'];
    const limits: Record<string, number> = {
        incoming: 20,      // Only show recent incoming
        ai_generated: 50,
        waiting_approval: 50,
        approved: 50,
        scheduled: 50,
        published: 30,
        rejected: 20,
    };

    const queries = statuses.map(status =>
        supabase
            .from('content_items')
            .select(`
                *,
                category:categories(*),
                source:rss_sources(*)
            `)
            .eq('status', status)
            .order('updated_at', { ascending: false })
            .limit(limits[status] || 30)
    );

    const results = await Promise.all(queries);
    const allItems: any[] = [];
    for (const result of results) {
        if (result.error) throw result.error;
        if (result.data) allItems.push(...result.data);
    }

    // Sort by updated_at descending
    allItems.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    return allItems;
}

export async function getContentItemsByStatus(status: ContentItem['status']) {
    const { data, error } = await supabase
        .from('content_items')
        .select(`
      *,
      category:categories(*),
      source:rss_sources(*)
    `)
        .eq('status', status)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getContentItemById(id: string) {
    const { data, error } = await supabase
        .from('content_items')
        .select(`
      *,
      category:categories(*),
      source:rss_sources(*)
    `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function createContentItem(item: ContentItemInsert) {
    const { data, error } = await supabase
        .from('content_items')
        .insert(item)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateContentItem(id: string, updates: ContentItemUpdate) {
    const { data, error } = await supabase
        .from('content_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateContentStatus(id: string, status: ContentItem['status']) {
    return updateContentItem(id, { status });
}

export async function approveContent(id: string, scheduledAt?: string) {
    return updateContentItem(id, {
        status: 'approved',
        scheduled_at: scheduledAt
    });
}

export async function rejectContent(id: string) {
    return updateContentItem(id, { status: 'rejected' });
}

// ============================================
// Categories
// ============================================

export async function getCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data;
}

export async function getCategoryById(id: string) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

// ============================================
// RSS Sources
// ============================================

export async function getRssSources() {
    const { data, error } = await supabase
        .from('rss_sources')
        .select(`
      *,
      category:categories(*)
    `)
        .order('name');

    if (error) throw error;
    return data;
}

export async function getActiveRssSources() {
    const { data, error } = await supabase
        .from('rss_sources')
        .select(`
      *,
      category:categories(*)
    `)
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data;
}

export async function createRssSource(source: Database['public']['Tables']['rss_sources']['Insert']) {
    const { data, error } = await supabase
        .from('rss_sources')
        .insert(source)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateRssSource(id: string, updates: Database['public']['Tables']['rss_sources']['Update']) {
    const { data, error } = await supabase
        .from('rss_sources')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteRssSource(id: string) {
    const { error } = await supabase
        .from('rss_sources')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// LLM Providers
// ============================================

export async function getLlmProviders() {
    const { data, error } = await supabase
        .from('llm_providers')
        .select('*')
        .order('priority');

    if (error) throw error;
    return data;
}

export async function getDefaultLlmProvider() {
    const { data, error } = await supabase
        .from('llm_providers')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

    if (error) throw error;
    return data;
}

// ============================================
// Realtime Subscriptions
// ============================================

export function subscribeToContentChanges(
    callback: (payload: { new: ContentItem; old: ContentItem | null }) => void
) {
    return supabase
        .channel('content_items_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'content_items' },
            (payload) => {
                callback({
                    new: payload.new as ContentItem,
                    old: payload.old as ContentItem | null
                });
            }
        )
        .subscribe();
}
