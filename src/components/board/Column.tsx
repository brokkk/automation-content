import { useState } from 'react';
import type { ContentItem, ContentStatus } from '../../types';
import { ContentCard } from './ContentCard';

interface ColumnProps {
    id: ContentStatus;
    title: string;
    color: string;
    items: ContentItem[];
    selectedItemId?: string;
    onSelectItem?: (item: ContentItem) => void;
}

const ITEMS_PER_PAGE = 10;

export function Column({
    id,
    title,
    color,
    items,
    selectedItemId,
    onSelectItem
}: ColumnProps) {
    const [showAll, setShowAll] = useState(false);
    const isPulsing = title === 'AI Generated';
    const isScheduled = title === 'Scheduled';
    const isIncoming = id === 'incoming';

    // Limit items for incoming column
    const visibleItems = (isIncoming && !showAll)
        ? items.slice(0, ITEMS_PER_PAGE)
        : items;
    const hasMore = isIncoming && items.length > ITEMS_PER_PAGE;

    return (
        <div className={`flex-1 min-w-0 flex flex-col h-full ${isScheduled ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <span
                        className={`w-2 h-2 rounded-full ${color} ${isPulsing ? 'animate-pulse' : ''}`}
                    />
                    <h3 className="font-bold text-sm text-text-main dark:text-white uppercase tracking-wider">
                        {title}
                    </h3>
                    <span className="bg-border-light dark:bg-[#2f3a25] text-xs font-bold px-2 py-0.5 rounded-full text-text-muted">
                        {items.length}
                    </span>
                </div>
                <button className="text-text-muted hover:text-text-main dark:hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                </button>
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
                {visibleItems.length > 0 ? (
                    <>
                        {visibleItems.map((item) => (
                            <ContentCard
                                key={item.id}
                                item={item}
                                isSelected={item.id === selectedItemId}
                                onClick={() => onSelectItem?.(item)}
                            />
                        ))}

                        {/* Show More / Show Less Button */}
                        {hasMore && (
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className="py-2 px-4 text-sm font-medium text-primary hover:text-primary/80 
                                         bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors
                                         flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {showAll ? 'expand_less' : 'expand_more'}
                                </span>
                                {showAll
                                    ? 'Show Less'
                                    : `Show ${items.length - ITEMS_PER_PAGE} More`}
                            </button>
                        )}
                    </>
                ) : (
                    <div className="border-2 border-dashed border-border-light dark:border-border-dark rounded-xl h-24 flex items-center justify-center text-text-muted text-sm">
                        {isScheduled ? 'Drop to schedule' : 'No items'}
                    </div>
                )}
            </div>
        </div>
    );
}

