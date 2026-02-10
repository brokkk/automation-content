import type { ContentItem, ContentStatus } from '../../types';
import { Column } from './Column';

interface KanbanBoardProps {
    items: ContentItem[];
    selectedItemId?: string;
    onSelectItem?: (item: ContentItem) => void;
}

interface ColumnConfig {
    id: ContentStatus;
    title: string;
    color: string;
}

const columns: ColumnConfig[] = [
    { id: 'incoming', title: 'Incoming RSS', color: 'bg-blue-400' },
    { id: 'ai_generated', title: 'AI Generated', color: 'bg-primary' },
    { id: 'waiting_approval', title: 'Waiting Approval', color: 'bg-orange-400' },
    { id: 'approved', title: 'Approved', color: 'bg-green-500' },
    { id: 'scheduled', title: 'Scheduled', color: 'bg-gray-400' },
    { id: 'published', title: 'Published', color: 'bg-emerald-500' },
    { id: 'rejected', title: 'Rejected', color: 'bg-red-400' },
];

export function KanbanBoard({ items, selectedItemId, onSelectItem }: KanbanBoardProps) {
    // Group items by status
    const groupedItems = columns.reduce((acc, column) => {
        acc[column.id] = items.filter(item => item.status === column.id);
        return acc;
    }, {} as Record<ContentStatus, ContentItem[]>);

    return (
        <div className="flex-1 overflow-hidden p-6">
            <div className="flex gap-4 h-full">
                {columns.map((column) => (
                    <Column
                        key={column.id}
                        id={column.id}
                        title={column.title}
                        color={column.color}
                        items={groupedItems[column.id] || []}
                        selectedItemId={selectedItemId}
                        onSelectItem={onSelectItem}
                    />
                ))}
            </div>
        </div>
    );
}
