import { useState, useEffect } from 'react';
import { getPlatformConfigs, updatePlatformConfig } from '../lib/automation-api';
import type { PlatformConfig, ContentTone } from '../lib/automation-types';

const TONE_OPTIONS: { value: ContentTone; label: string; description: string }[] = [
    { value: 'casual', label: 'Casual', description: 'Santai, friendly, banyak emoji' },
    { value: 'professional', label: 'Professional', description: 'Formal, bisnis' },
    { value: 'humorous', label: 'Humorous', description: 'Lucu, menghibur' },
    { value: 'informative', label: 'Informative', description: 'Edukatif, detail' },
    { value: 'inspirational', label: 'Inspirational', description: 'Motivasi, positif' },
];

const PLATFORM_ICONS: Record<string, string> = {
    instagram: '📸',
    facebook: '👍',
    threads: '🧵',
    twitter: '𝕏',
};

export function PlatformSettingsPage() {
    const [configs, setConfigs] = useState<PlatformConfig[]>([]);
    const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        tone: 'casual' as ContentTone,
        language: 'id',
        use_emoji: true,
        max_length: 2200,
        hashtags: '',
        cta_template: '',
        prompt_template: '',
        is_active: true,
    });

    useEffect(() => {
        loadConfigs();
    }, []);

    useEffect(() => {
        const config = configs.find(c => c.platform === selectedPlatform);
        if (config) {
            setFormData({
                tone: config.tone,
                language: config.language,
                use_emoji: config.use_emoji,
                max_length: config.max_length,
                hashtags: config.hashtags,
                cta_template: config.cta_template,
                prompt_template: config.prompt_template,
                is_active: config.is_active,
            });
        }
    }, [selectedPlatform, configs]);

    const loadConfigs = async () => {
        setLoading(true);
        const data = await getPlatformConfigs();
        setConfigs(data);
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        const result = await updatePlatformConfig(selectedPlatform as any, formData);

        if (result) {
            setMessage({ type: 'success', text: 'Settings saved!' });
            loadConfigs();
        } else {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        }

        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    const selectedConfig = configs.find(c => c.platform === selectedPlatform);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-main">Platform Settings</h1>
                <p className="text-muted mt-1">Configure content character and style for each platform</p>
            </div>

            {/* Platform Tabs */}
            <div className="flex gap-2 mb-6">
                {configs.map(config => (
                    <button
                        key={config.platform}
                        onClick={() => setSelectedPlatform(config.platform)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${selectedPlatform === config.platform
                            ? 'bg-primary text-primary-content'
                            : 'bg-surface text-muted hover:text-main'
                            }`}
                    >
                        <span>{PLATFORM_ICONS[config.platform] || '📱'}</span>
                        <span className="capitalize">{config.platform}</span>
                        {!config.is_active && (
                            <span className="text-xs bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded">OFF</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Settings Form */}
            {selectedConfig && (
                <div className="bg-main rounded-xl border border-main p-6 space-y-6">
                    {/* Active Toggle */}
                    <div className="flex items-center justify-between pb-4 border-b border-main">
                        <div>
                            <h3 className="font-bold text-main">Enable {selectedPlatform}</h3>
                            <p className="text-sm text-muted">Generate content for this platform</p>
                        </div>
                        <button
                            onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-primary' : 'bg-gray-400'
                                }`}
                        >
                            <span
                                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.is_active ? 'left-7' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Tone Selection */}
                    <div>
                        <label className="block text-sm font-bold text-main mb-3">Content Tone</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {TONE_OPTIONS.map(tone => (
                                <button
                                    key={tone.value}
                                    onClick={() => setFormData({ ...formData, tone: tone.value })}
                                    className={`p-3 rounded-lg border text-left transition-all ${formData.tone === tone.value
                                        ? 'border-primary bg-primary/10'
                                        : 'border-main hover:border-primary/50'
                                        }`}
                                >
                                    <span className="font-medium text-main">{tone.label}</span>
                                    <p className="text-xs text-muted mt-0.5">{tone.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Language & Caption Length */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-main mb-2">Language</label>
                            <select
                                value={formData.language}
                                onChange={e => setFormData({ ...formData, language: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-main bg-main text-main"
                            >
                                <option value="id">Indonesian</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-main mb-2">Caption Length</label>
                            <select
                                value={formData.max_length <= 300 ? 'short' : formData.max_length <= 600 ? 'medium' : 'long'}
                                onChange={e => {
                                    const lengths = { short: 200, medium: 400, long: 800 };
                                    setFormData({ ...formData, max_length: lengths[e.target.value as keyof typeof lengths] });
                                }}
                                className="w-full px-4 py-2 rounded-lg border border-main bg-main text-main"
                            >
                                <option value="short">Short (100-200 chars)</option>
                                <option value="medium">Medium (300-400 chars)</option>
                                <option value="long">Long (600-800 chars)</option>
                            </select>
                        </div>
                    </div>

                    {/* Emoji Toggle */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="use-emoji"
                            checked={formData.use_emoji}
                            onChange={e => setFormData({ ...formData, use_emoji: e.target.checked })}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="use-emoji" className="text-main">
                            Use emoji in generated content 😊
                        </label>
                    </div>

                    {/* Hashtags */}
                    <div>
                        <label className="block text-sm font-bold text-main mb-2">Default Hashtags</label>
                        <input
                            type="text"
                            value={formData.hashtags}
                            onChange={e => setFormData({ ...formData, hashtags: e.target.value })}
                            placeholder="#berita #viral #trending"
                            className="w-full px-4 py-2 rounded-lg border border-main bg-main text-main placeholder:text-muted"
                        />
                        <p className="text-xs text-muted mt-1">Separate with spaces</p>
                    </div>

                    {/* CTA Template */}
                    <div>
                        <label className="block text-sm font-bold text-main mb-2">Call-to-Action Template</label>
                        <input
                            type="text"
                            value={formData.cta_template}
                            onChange={e => setFormData({ ...formData, cta_template: e.target.value })}
                            placeholder="Follow @yourbrand untuk update! 🔥"
                            className="w-full px-4 py-2 rounded-lg border border-main bg-main text-main placeholder:text-muted"
                        />
                    </div>


                    {/* Save Button */}
                    <div className="flex items-center gap-4 pt-4 border-t border-main">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-content font-bold px-6 py-2.5 rounded-lg flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-primary-content border-t-transparent rounded-full"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[20px]">save</span>
                                    Save Settings
                                </>
                            )}
                        </button>

                        {message && (
                            <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                                {message.type === 'success' ? '✓' : '✗'} {message.text}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {configs.length === 0 && (
                <div className="bg-surface rounded-xl p-8 text-center">
                    <p className="text-muted">No platform configurations found.</p>
                    <p className="text-sm text-muted mt-2">Run the migration script first.</p>
                </div>
            )}
        </div>
    );
}
