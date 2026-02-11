import type { ContentItem, Category } from '../../types';

interface ContentCardProps {
    item: ContentItem;
    isSelected?: boolean;
    onClick?: () => void;
}

// Category color mapping
const categoryColors: Record<string, string> = {
    Tech: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    Design: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
    Fashion: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
    Sneakers: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
    Food: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    Travel: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100',
    Lifestyle: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
    News: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    Finance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    Business: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100',
};

function getCategoryClass(category?: Category): string {
    if (!category) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
    return categoryColors[category.name] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
}

function getConfidenceColor(confidence?: number): string {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.9) return 'text-primary';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-500';
}

function formatTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

export function ContentCard({ item, isSelected, onClick }: ContentCardProps) {
    const showConfidence = item.status === 'ai_generated' && item.aiConfidence;
    const hasImage = item.originalImage || item.generatedImage;

    return (
        <div
            onClick={onClick}
            className={`group bg-surface-light dark:bg-surface-dark rounded-xl cursor-pointer transition-all relative overflow-hidden ${isSelected
                ? 'border-2 border-primary shadow-lg bg-white dark:bg-[#2a3321]'
                : 'border border-transparent hover:border-primary/30 hover:shadow-md'
                }`}
        >
            {/* Compact layout: image left, text right */}
            <div className="flex gap-3 p-3">
                {/* Small thumbnail */}
                {hasImage && (
                    <div
                        className="w-16 h-16 rounded-lg bg-cover bg-center flex-shrink-0"
                        style={{
                            backgroundImage: item.generatedImage
                                ? `url(${item.generatedImage})`
                                : item.originalImage
                                    ? `url(${item.originalImage})`
                                    : 'linear-gradient(to bottom right, #a855f7, #3b82f6)',
                        }}
                    />
                )}

                {/* Text content */}
                <div className="flex-1 min-w-0">
                    {/* Top row: Category + Time */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                            {item.category && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getCategoryClass(item.category)}`}>
                                    {item.category.name}
                                </span>
                            )}
                            {showConfidence && item.aiConfidence && (
                                <span className={`text-[10px] font-bold ${getConfidenceColor(item.aiConfidence)}`}>
                                    {Math.round(item.aiConfidence * 100)}%
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-text-muted flex-shrink-0">{formatTimeAgo(item.createdAt)}</span>
                    </div>

                    {/* Title — 2 lines max */}
                    <h4 className="font-bold text-xs leading-tight text-text-main dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                        {item.headline || item.originalTitle}
                    </h4>

                    {/* Bottom row: Source + Link */}
                    <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1.5">
                            {item.source && (
                                <>
                                    <div className="w-3.5 h-3.5 rounded-full bg-primary/30 flex items-center justify-center text-[7px] font-bold flex-shrink-0">
                                        {item.source.name.charAt(0)}
                                    </div>
                                    <span className="text-[10px] text-text-muted truncate max-w-[80px]">{item.source.name}</span>
                                </>
                            )}
                        </div>
                        {item.originalUrl && (
                            <a
                                href={item.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-primary hover:underline flex-shrink-0"
                                title="Open original article"
                            >
                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
