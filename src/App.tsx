import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DetailPanel } from './components/layout/DetailPanel';
import { KanbanBoard } from './components/board/KanbanBoard';
import { ApprovalPage } from './pages/ApprovalPage';
import { RssSourcesPage } from './pages/RssSourcesPage';
import { TestPipelinePage } from './pages/TestPipelinePage';
import { ImageGeneratorPage } from './pages/ImageGeneratorPage';
import { PlatformSettingsPage } from './pages/PlatformSettingsPage';
import { TelegramSettingsPage } from './pages/TelegramSettingsPage';
import { useContentItems } from './lib/hooks';
import type { ContentItem } from './types';
import './index.css';

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden flex bg-main text-main">
      <Sidebar activeItem="Content Pipeline" />
      <main className="flex-1 flex flex-col h-full min-w-0 relative overflow-auto bg-surface">
        {children}
      </main>
    </div>
  );
}

function PipelinePage() {
  const { items, loading, error, approve, reject, refetch } = useContentItems();
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  // Map Supabase items to ContentItem type
  const mappedItems: ContentItem[] = items.map(item => ({
    id: item.id,
    status: item.status || 'incoming',
    headline: item.headline || item.original_title || 'Untitled',
    subheadline: item.subheadline || item.original_desc || '',
    originalTitle: item.original_title || 'Untitled',
    originalUrl: item.original_url || '',
    originalImage: item.original_image || undefined,
    generatedImage: (item as any).generated_image || undefined,
    platform: (item.platform as 'instagram' | 'facebook' | 'both') || 'both',
    aiConfidence: item.ai_confidence ? Number(item.ai_confidence) : undefined,
    createdAt: item.created_at || new Date().toISOString(),
    updatedAt: item.updated_at || new Date().toISOString(),
    scheduledAt: item.scheduled_at || undefined,
    selectedVar: 0,
    igCaption: item.ig_caption || undefined,
    fbCaption: item.fb_caption || undefined,
    source: item.source ? {
      id: item.source.id,
      name: item.source.name || 'Unknown',
      url: item.source.url || '',
      isActive: item.source.is_active ?? true,
    } : undefined,
    category: item.category ? {
      id: item.category.id,
      name: item.category.name || 'Uncategorized',
      slug: item.category.slug || 'uncategorized',
      color: item.category.color || '#6B7280',
      isActive: item.category.is_active ?? true,
    } : undefined,
  }));

  const handleApprove = async () => {
    if (selectedItem) {
      await approve(selectedItem.id);
      setSelectedItem(null);
      refetch();
    }
  };

  const handleReject = async () => {
    if (selectedItem) {
      await reject(selectedItem.id);
      setSelectedItem(null);
      refetch();
    }
  };

  return (
    <>
      <Header
        title="Pipeline Dashboard"
        onNewPost={() => console.log('New Post clicked')}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              Error: {error.message}
            </div>
          ) : (
            <KanbanBoard
              items={mappedItems}
              selectedItemId={selectedItem?.id}
              onSelectItem={setSelectedItem}
            />
          )}
        </div>
        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={() => console.log('Edit')}
          />
        )}
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout><PipelinePage /></DashboardLayout>} />
        <Route path="/sources" element={<DashboardLayout><RssSourcesPage /></DashboardLayout>} />
        <Route path="/test" element={<DashboardLayout><TestPipelinePage /></DashboardLayout>} />
        <Route path="/images" element={<DashboardLayout><ImageGeneratorPage /></DashboardLayout>} />
        <Route path="/settings" element={<DashboardLayout><PlatformSettingsPage /></DashboardLayout>} />
        <Route path="/platforms" element={<DashboardLayout><PlatformSettingsPage /></DashboardLayout>} />
        <Route path="/telegram" element={<DashboardLayout><TelegramSettingsPage /></DashboardLayout>} />
        <Route path="/approve/:token" element={<ApprovalPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
