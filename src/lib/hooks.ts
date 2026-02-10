import { useState, useEffect, useCallback } from 'react';
import {
    getContentItems,
    updateContentStatus,
    approveContent,
    rejectContent,
    subscribeToContentChanges
} from './api';
import type { Database } from './database.types';

type ContentItem = Database['public']['Tables']['content_items']['Row'] & {
    category?: Database['public']['Tables']['categories']['Row'] | null;
    source?: Database['public']['Tables']['rss_sources']['Row'] | null;
};

interface UseContentItemsReturn {
    items: ContentItem[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    approve: (id: string, scheduledAt?: string) => Promise<void>;
    reject: (id: string) => Promise<void>;
    updateStatus: (id: string, status: ContentItem['status']) => Promise<void>;
}

export function useContentItems(): UseContentItemsReturn {
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getContentItems();
            setItems(data as ContentItem[]);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch items'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();

        // Subscribe to realtime changes
        const subscription = subscribeToContentChanges((payload) => {
            setItems((current) => {
                const index = current.findIndex((item) => item.id === payload.new.id);
                if (index >= 0) {
                    // Update existing item
                    const updated = [...current];
                    updated[index] = { ...current[index], ...payload.new };
                    return updated;
                } else {
                    // Add new item
                    return [payload.new as ContentItem, ...current];
                }
            });
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchItems]);

    const approve = useCallback(async (id: string, scheduledAt?: string) => {
        await approveContent(id, scheduledAt);
    }, []);

    const reject = useCallback(async (id: string) => {
        await rejectContent(id);
    }, []);

    const updateStatus = useCallback(async (id: string, status: ContentItem['status']) => {
        await updateContentStatus(id, status);
    }, []);

    return {
        items,
        loading,
        error,
        refetch: fetchItems,
        approve,
        reject,
        updateStatus,
    };
}
