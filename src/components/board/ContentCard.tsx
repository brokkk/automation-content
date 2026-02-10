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
    Finance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    Marketing: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
};

function getCategoryClass(category?: Category): string {
    if (!category) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
    return categoryColors[category.name] || categoryColors.Tech;
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
    const hasImage = item.originalImage || item.status === 'ai_generated' || item.status === 'waiting_approval';
    const showConfidence = item.status === 'ai_generated' && item.aiConfidence;
    const showPlatforms = item.status === 'waiting_approval' || item.status === 'approved';

    return (
        <div
            onClick={onClick}
            className={`group bg-surface-light dark:bg-surface-dark p-3 rounded-xl shadow-sm cursor-pointer transition-all relative overflow-hidden ${isSelected
                ? 'border-2 border-primary shadow-lg bg-white dark:bg-[#2a3321]'
                : 'border border-transparent hover:border-primary/30 hover:shadow-md'
                }`}
        >
            {/* Selected indicator */}
            {isSelected && (
                <div className="absolute -right-2 -top-2 bg-primary text-primary-content rounded-full p-1 shadow-md">
                    <span className="material-symbols-outlined text-[14px] block">edit</span>
                </div>
            )}

            {/* AI Generated glow effect */}
            {item.status === 'ai_generated' && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-3xl -mr-2 -mt-2"></div>
            )}

            {/* Thumbnail */}
            {hasImage && (
                <div
                    className="h-32 w-full rounded-lg mb-3 bg-cover bg-center"
                    style={{
                        backgroundImage: item.generatedImage
                            ? `url(${item.generatedImage})`
                            : item.originalImage
                                ? `url(${item.originalImage})`
                                : 'linear-gradient(to bottom right, #a855f7, #3b82f6)',
                    }}
                />
            )}

            {/* Header: Category + Time or Confidence */}
            <div className="flex justify-between items-start mb-2">
                {item.category && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryClass(item.category)}`}>
                        {item.category.name}
                    </span>
                )}

                {showConfidence && item.aiConfidence ? (
                    <div className={`flex items-center gap-1 ${getConfidenceColor(item.aiConfidence)}`}>
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        <span className="text-xs font-bold">{Math.round(item.aiConfidence * 100)}% Confidence</span>
                    </div>
                ) : (
                    <span className="text-[10px] text-text-muted">{formatTimeAgo(item.createdAt)}</span>
                )}
            </div>

            {/* Title */}
            <h4 className="font-bold text-sm leading-tight mb-2 text-text-main dark:text-white group-hover:text-primary transition-colors">
                {item.headline || item.originalTitle}
            </h4>

            {/* Source & Article Link - Show for all statuses */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {item.source && (
                        <>
                            <div className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center text-[8px] font-bold">
                                {item.source.name.charAt(0)}
                            </div>
                            <span className="text-xs text-text-muted">{item.source.name}</span>
                        </>
                    )}
                </div>
                {item.originalUrl && (
                    <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        title="Open original article"
                    >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Source
                    </a>
                )}
            </div>

            {/* Platforms (for approval stages) */}
            {showPlatforms && (
                <div className="flex items-center gap-2 mt-2">
                    <div className="flex -space-x-2">
                        {(item.platform === 'facebook' || item.platform === 'both') && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] border-2 border-white dark:border-surface-dark font-bold">
                                fb
                            </div>
                        )}
                        {(item.platform === 'instagram' || item.platform === 'both') && (
                            <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-[10px] border-2 border-white dark:border-surface-dark font-bold">
                                ig
                            </div>
                        )}
                    </div>
                    <span className="text-xs text-text-muted ml-1">
                        {item.status === 'approved' ? 'Approved' : 'Ready for review'}
                    </span>
                </div>
            )}

            {/* Approved status */}
            {item.status === 'approved' && (
                <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-text-muted">
                        {item.scheduledAt ? `Scheduled for ${new Date(item.scheduledAt).toLocaleDateString()}` : 'Ready to schedule'}
                    </p>
                    <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                </div>
            )}
        </div>
    );
}
