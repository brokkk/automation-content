import { useState, useEffect } from 'react';
import { getTelegramSettings, saveTelegramSettings, testTelegramConnection } from '../lib/automation-api';
import type { TelegramSettings } from '../lib/automation-types';

export function TelegramSettingsPage() {
    const [settings, setSettings] = useState<Partial<TelegramSettings>>({
        bot_token: '',
        chat_id: '',
        is_active: true,
        notify_on_new_content: true,
        notify_on_publish_success: true,
        notify_on_publish_error: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        const data = await getTelegramSettings();
        if (data) {
            setSettings(data);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        const result = await saveTelegramSettings(settings);

        if (result) {
            setMessage({ type: 'success', text: 'Settings saved!' });
        } else {
            setMessage({ type: 'error', text: 'Failed to save' });
        }

        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    const handleTest = async () => {
        if (!settings.bot_token || !settings.chat_id) {
            setMessage({ type: 'error', text: 'Please enter bot token and chat ID first' });
            return;
        }

        setTesting(true);
        setMessage(null);

        const success = await testTelegramConnection(settings.bot_token, settings.chat_id);

        if (success) {
            setMessage({ type: 'success', text: 'Test message sent! Check your Telegram.' });
        } else {
            setMessage({ type: 'error', text: 'Connection failed. Check your bot token and chat ID.' });
        }

        setTesting(false);
        setTimeout(() => setMessage(null), 5000);
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-main">Telegram Notifications</h1>
                <p className="text-muted mt-1">Configure Telegram bot for approval notifications</p>
            </div>

            {/* Setup Guide */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 mb-6">
                <h3 className="font-bold text-primary flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined">help</span>
                    How to Setup Telegram Bot
                </h3>
                <ol className="space-y-2 text-sm text-main">
                    <li className="flex gap-2">
                        <span className="font-bold text-primary">1.</span>
                        <span>Open Telegram and search for <strong>@BotFather</strong></span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-bold text-primary">2.</span>
                        <span>Send <code className="bg-surface px-1.5 py-0.5 rounded">/newbot</code> and follow instructions</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-bold text-primary">3.</span>
                        <span>Copy the <strong>Bot Token</strong> and paste below</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-bold text-primary">4.</span>
                        <span>To get Chat ID: Send a message to your bot, then visit:<br />
                            <code className="bg-surface px-1.5 py-0.5 rounded text-xs">https://api.telegram.org/bot[TOKEN]/getUpdates</code>
                        </span>
                    </li>
                </ol>
            </div>

            {/* Settings Form */}
            <div className="bg-main rounded-xl border border-main p-6 space-y-6">
                {/* Active Toggle */}
                <div className="flex items-center justify-between pb-4 border-b border-main">
                    <div>
                        <h3 className="font-bold text-main">Enable Notifications</h3>
                        <p className="text-sm text-muted">Receive content approval requests via Telegram</p>
                    </div>
                    <button
                        onClick={() => setSettings({ ...settings, is_active: !settings.is_active })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${settings.is_active ? 'bg-primary' : 'bg-gray-400'
                            }`}
                    >
                        <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.is_active ? 'left-7' : 'left-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Bot Token */}
                <div>
                    <label className="block text-sm font-bold text-main mb-2">Bot Token</label>
                    <input
                        type="password"
                        value={settings.bot_token || ''}
                        onChange={e => setSettings({ ...settings, bot_token: e.target.value })}
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        className="w-full px-4 py-2 rounded-lg border border-main bg-main text-main font-mono text-sm placeholder:text-muted"
                    />
                </div>

                {/* Chat ID */}
                <div>
                    <label className="block text-sm font-bold text-main mb-2">Chat ID</label>
                    <input
                        type="text"
                        value={settings.chat_id || ''}
                        onChange={e => setSettings({ ...settings, chat_id: e.target.value })}
                        placeholder="123456789 or -100123456789 (for groups)"
                        className="w-full px-4 py-2 rounded-lg border border-main bg-main text-main font-mono text-sm placeholder:text-muted"
                    />
                </div>

                {/* Notification Preferences */}
                <div className="space-y-3 pt-4 border-t border-main">
                    <h4 className="font-bold text-main">Notification Types</h4>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notify_on_new_content}
                            onChange={e => setSettings({ ...settings, notify_on_new_content: e.target.checked })}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-main">New content ready for approval</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notify_on_publish_success}
                            onChange={e => setSettings({ ...settings, notify_on_publish_success: e.target.checked })}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-main">Content published successfully</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notify_on_publish_error}
                            onChange={e => setSettings({ ...settings, notify_on_publish_error: e.target.checked })}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-main">Publish errors</span>
                    </label>
                </div>

                {/* Actions */}
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

                    <button
                        onClick={handleTest}
                        disabled={testing || !settings.bot_token || !settings.chat_id}
                        className="border border-primary text-primary hover:bg-primary/10 disabled:opacity-50 font-bold px-6 py-2.5 rounded-lg flex items-center gap-2"
                    >
                        {testing ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                                Testing...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[20px]">send</span>
                                Test Connection
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
        </div>
    );
}
