import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { validateApprovalToken, processApproval } from '../lib/approval';
import type { Database } from '../lib/database.types';

type ContentItem = Database['public']['Tables']['content_items']['Row'];

export function ApprovalPage() {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<ContentItem | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<'approved' | 'rejected' | null>(null);
    const [activeTab, setActiveTab] = useState<'instagram' | 'facebook'>('instagram');

    useEffect(() => {
        async function validate() {
            if (!token) {
                setError('No token provided');
                setLoading(false);
                return;
            }

            const validation = await validateApprovalToken(token);

            if (!validation.valid) {
                setError(validation.error || 'Invalid token');
            } else if (validation.content) {
                setContent(validation.content);
            }

            setLoading(false);
        }

        validate();
    }, [token]);

    const handleAction = async (action: 'approve' | 'reject') => {
        if (!token) return;

        setProcessing(true);
        const response = await processApproval(token, action, {
            scheduledAt: action === 'approve'
                ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                : undefined,
        });

        if (response.success) {
            setResult(action === 'approve' ? 'approved' : 'rejected');
        } else {
            setError(response.error || 'Failed to process action');
        }
        setProcessing(false);
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6">
                <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-center max-w-md">
                    <span className="material-symbols-outlined text-4xl mb-2 block">error</span>
                    <h1 className="text-lg font-bold mb-2">Unable to Process</h1>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    // Success state
    if (result) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6">
                <div className={`p-6 rounded-xl text-center max-w-md ${result === 'approved'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                    }`}>
                    <span className="material-symbols-outlined text-5xl mb-3 block">
                        {result === 'approved' ? 'check_circle' : 'cancel'}
                    </span>
                    <h1 className="text-xl font-bold mb-2">
                        {result === 'approved' ? 'Content Approved!' : 'Content Rejected'}
                    </h1>
                    <p className="text-sm opacity-80">
                        {result === 'approved'
                            ? 'This content has been scheduled for publishing.'
                            : 'This content has been removed from the queue.'}
                    </p>
                </div>
            </div>
        );
    }

    // Main approval UI
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-main dark:text-white">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between max-w-lg mx-auto">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary rounded-lg size-8 flex items-center justify-center text-primary-content">
                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        </div>
                        <span className="font-bold">AI Auto</span>
                    </div>
                    <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md font-bold">
                        REVIEW
                    </span>
                </div>
            </header>

            <main className="max-w-lg mx-auto p-4 pb-32">
                {/* Content Preview */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-sm mb-4">
                    {/* Image */}
                    <div
                        className="aspect-square w-full bg-cover bg-center"
                        style={{
                            backgroundImage: content?.original_image
                                ? `url(${content.original_image})`
                                : 'linear-gradient(to bottom right, #fbbf24, #f97316)',
                        }}
                    />

                    {/* Platform Tabs */}
                    <div className="flex border-b border-border-light dark:border-border-dark">
                        <button
                            onClick={() => setActiveTab('instagram')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'instagram'
                                    ? 'border-b-2 border-primary text-primary'
                                    : 'text-text-muted'
                                }`}
                        >
                            Instagram
                        </button>
                        <button
                            onClick={() => setActiveTab('facebook')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'facebook'
                                    ? 'border-b-2 border-primary text-primary'
                                    : 'text-text-muted'
                                }`}
                        >
                            Facebook
                        </button>
                    </div>

                    {/* Caption */}
                    <div className="p-4">
                        <h2 className="font-bold text-lg mb-2">
                            {content?.headline || content?.original_title}
                        </h2>
                        <p className="text-sm leading-relaxed whitespace-pre-line">
                            {activeTab === 'instagram'
                                ? content?.ig_caption || 'No caption generated'
                                : content?.fb_caption || 'No caption generated'}
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-surface-light dark:bg-surface-dark p-3 rounded-lg">
                        <span className="text-[10px] text-text-muted uppercase block mb-1">Characters</span>
                        <span className="font-bold">
                            {(activeTab === 'instagram' ? content?.ig_caption : content?.fb_caption)?.length || 0}
                        </span>
                    </div>
                    <div className="bg-surface-light dark:bg-surface-dark p-3 rounded-lg">
                        <span className="text-[10px] text-text-muted uppercase block mb-1">AI Confidence</span>
                        <span className="font-bold text-primary">
                            {content?.ai_confidence ? `${Math.round(Number(content.ai_confidence) * 100)}%` : 'N/A'}
                        </span>
                    </div>
                </div>
            </main>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4 safe-area-pb">
                <div className="max-w-lg mx-auto space-y-3">
                    <button
                        onClick={() => handleAction('approve')}
                        disabled={processing}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-content font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {processing ? (
                            <div className="animate-spin h-5 w-5 border-2 border-primary-content border-t-transparent rounded-full"></div>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">check_circle</span>
                                Approve & Schedule
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => handleAction('reject')}
                        disabled={processing}
                        className="w-full bg-transparent border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined">cancel</span>
                        Reject
                    </button>
                </div>
            </div>
        </div>
    );
}
