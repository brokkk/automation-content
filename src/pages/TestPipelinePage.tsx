import { useState } from 'react';
import { runFullPipeline } from '../lib/workflow';

export function TestPipelinePage() {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        contentId?: string;
        approvalUrl?: string;
        error?: string;
    } | null>(null);

    const handleTest = async () => {
        if (!url || !title) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await runFullPipeline({
                title,
                description: description || undefined,
                link: url,
                guid: `test-${Date.now()}`,
                sourceId: undefined, // No source for manual test
            });
            setResult(response);
        } catch (err) {
            setResult({
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }

        setLoading(false);
    };

    const handleTestSample = () => {
        setTitle('OpenAI Releases GPT-5 with Revolutionary Capabilities');
        setDescription('OpenAI has announced the release of GPT-5, featuring groundbreaking improvements in reasoning, multimodal understanding, and real-time collaboration. The new model shows significant advances in code generation and creative writing tasks.');
        setUrl('https://techcrunch.com/2024/12/01/openai-gpt-5-release');
    };

    return (
        <div className="p-8 max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">Test Full Pipeline</h1>
            <p className="text-text-muted mb-6">
                Test the complete content pipeline: RSS → AI Generation → Approval Request
            </p>

            {/* Sample Data Button */}
            <button
                onClick={handleTestSample}
                className="mb-6 text-sm text-primary hover:underline"
            >
                ← Load sample article data
            </button>

            {/* Form */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 space-y-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                        Article Title *
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter article title"
                        className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark focus:border-primary focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional article description"
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark focus:border-primary focus:outline-none resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                        Article URL *
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark focus:border-primary focus:outline-none"
                    />
                </div>

                <button
                    onClick={handleTest}
                    disabled={loading || !url || !title}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-content font-bold py-3 rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin h-5 w-5 border-2 border-primary-content border-t-transparent rounded-full"></div>
                            Processing...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">play_arrow</span>
                            Run Full Pipeline
                        </>
                    )}
                </button>
            </div>

            {/* Result */}
            {result && (
                <div className={`rounded-xl p-6 ${result.success
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`material-symbols-outlined text-2xl ${result.success ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {result.success ? 'check_circle' : 'error'}
                        </span>
                        <h3 className={`font-bold ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                            }`}>
                            {result.success ? 'Pipeline Completed!' : 'Pipeline Failed'}
                        </h3>
                    </div>

                    {result.contentId && (
                        <p className="text-sm mb-2">
                            <span className="font-medium">Content ID:</span>{' '}
                            <code className="bg-black/10 px-2 py-0.5 rounded">{result.contentId}</code>
                        </p>
                    )}

                    {result.approvalUrl && (
                        <div className="mt-4">
                            <p className="text-sm font-medium mb-2">Approval Link:</p>
                            <a
                                href={result.approvalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline break-all text-sm"
                            >
                                {result.approvalUrl}
                            </a>
                        </div>
                    )}

                    {result.error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                            <span className="font-medium">Error:</span> {result.error}
                        </p>
                    )}
                </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    Pipeline Steps
                </h4>
                <ol className="text-sm space-y-1 text-blue-600 dark:text-blue-300">
                    <li>1. Creates content item in Supabase (status: incoming)</li>
                    <li>2. Generates AI captions using LLM (status: ai_generated)</li>
                    <li>3. Creates approval token (status: waiting_approval)</li>
                    <li>4. Returns approval URL for mobile review</li>
                </ol>
            </div>
        </div>
    );
}
