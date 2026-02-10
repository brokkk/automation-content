// Content Item Types
export interface ContentItem {
    id: string;
    originalTitle: string;
    originalDesc?: string;
    originalUrl: string;
    originalImage?: string;
    generatedImage?: string;
    headline?: string;
    subheadline?: string;
    igCaption?: string;
    fbCaption?: string;
    variations?: ContentVariation[];
    aiConfidence?: number;
    selectedVar: number;
    status: ContentStatus;
    platform: Platform;
    scheduledAt?: string;
    publishedAt?: string;
    createdAt: string;
    updatedAt: string;
    source?: RssSource;
    category?: Category;
}

export interface ContentVariation {
    headline: string;
    subheadline: string;
    igCaption: string;
    fbCaption: string;
}

export type ContentStatus =
    | 'incoming'
    | 'ai_generated'
    | 'draft'
    | 'waiting_approval'
    | 'approved'
    | 'scheduled'
    | 'published'
    | 'rejected'
    | 'failed';

export type Platform = 'instagram' | 'facebook' | 'both';

// RSS Source
export interface RssSource {
    id: string;
    name: string;
    url: string;
    favicon?: string;
    categoryId?: string;
    isActive: boolean;
}

// Category
export interface Category {
    id: string;
    name: string;
    slug: string;
    color: string;
    isActive: boolean;
}

// Kanban Column
export interface KanbanColumn {
    id: ContentStatus;
    title: string;
    color: string;
    items: ContentItem[];
}

// Navigation Item
export interface NavItem {
    name: string;
    icon: string;
    href: string;
    isActive?: boolean;
}
