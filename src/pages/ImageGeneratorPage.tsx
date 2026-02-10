import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { generateTemplateHtml, getTemplateSize, type TemplateType, type TemplateData } from '../lib/image';

export function ImageGeneratorPage() {
    const [templateType, setTemplateType] = useState<TemplateType>('instagram-post');
    const [formData, setFormData] = useState<TemplateData>({
        headline: 'The Future of AI Content is Here',
        subheadline: 'Discover how automation transforms your workflow',
        category: 'Tech',
        brandHandle: '@yourbrand',
    });
    const [previewHtml, setPreviewHtml] = useState('');
    const [downloading, setDownloading] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Generate preview when data changes
    useEffect(() => {
        const html = generateTemplateHtml(templateType, formData);
        setPreviewHtml(html);
    }, [templateType, formData]);

    const handleDownload = async () => {
        if (!iframeRef.current) return;

        setDownloading(true);

        try {
            const iframe = iframeRef.current;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

            if (!iframeDoc) {
                throw new Error('Cannot access iframe document');
            }

            // Wait for fonts to load
            await new Promise(resolve => setTimeout(resolve, 500));

            const size = getTemplateSize(templateType);

            // Capture the iframe content
            const canvas = await html2canvas(iframeDoc.body, {
                width: size.width,
                height: size.height,
                scale: 1,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
            });

            // Download
            const link = document.createElement('a');
            link.download = `${templateType}-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. For best results, use a server-side renderer like Playwright.');
        }

        setDownloading(false);
    };

    const size = getTemplateSize(templateType);
    const aspectRatio = size.width / size.height;

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Image Generator</h1>

            <div className="flex gap-8">
                {/* Left: Form */}
                <div className="w-96 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                            Template
                        </label>
                        <select
                            value={templateType}
                            onChange={(e) => setTemplateType(e.target.value as TemplateType)}
                            className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                        >
                            <option value="instagram-post">Instagram Post (1080×1350)</option>
                            <option value="facebook-post">Facebook Post (1200×628)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                            Category
                        </label>
                        <input
                            type="text"
                            value={formData.category || ''}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                            Headline
                        </label>
                        <textarea
                            value={formData.headline}
                            onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                            Subheadline
                        </label>
                        <textarea
                            value={formData.subheadline || ''}
                            onChange={(e) => setFormData({ ...formData, subheadline: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                            Brand Handle
                        </label>
                        <input
                            type="text"
                            value={formData.brandHandle || ''}
                            onChange={(e) => setFormData({ ...formData, brandHandle: e.target.value })}
                            className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                            Image URL (optional)
                        </label>
                        <input
                            type="url"
                            value={formData.imageUrl || ''}
                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                        />
                    </div>

                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-content font-bold py-3 rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        {downloading ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-primary-content border-t-transparent rounded-full"></div>
                                Generating...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">download</span>
                                Download Image
                            </>
                        )}
                    </button>
                </div>

                {/* Right: Preview */}
                <div className="flex-1">
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4">
                        <div className="text-xs font-bold text-text-muted uppercase mb-3">
                            Preview ({size.width}×{size.height})
                        </div>
                        <div
                            className="mx-auto overflow-hidden rounded-lg shadow-lg"
                            style={{
                                width: '100%',
                                maxWidth: templateType === 'facebook-post' ? '600px' : '400px',
                                aspectRatio: aspectRatio,
                            }}
                        >
                            <iframe
                                ref={iframeRef}
                                srcDoc={previewHtml}
                                className="w-full h-full border-0"
                                style={{
                                    transform: `scale(${templateType === 'facebook-post' ? 0.5 : 0.37})`,
                                    transformOrigin: 'top left',
                                    width: `${size.width}px`,
                                    height: `${size.height}px`,
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
