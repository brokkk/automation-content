import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type RssSource = Database['public']['Tables']['rss_sources']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export function RssSourcesPage() {
    const [sources, setSources] = useState<(RssSource & { category?: Category })[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        category_id: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);

        const [sourcesRes, categoriesRes] = await Promise.all([
            supabase.from('rss_sources').select('*, category:categories(*)').order('name'),
            supabase.from('categories').select('*').eq('is_active', true),
        ]);

        if (sourcesRes.data) {
            setSources(sourcesRes.data as (RssSource & { category?: Category })[]);
        }
        if (categoriesRes.data) {
            setCategories(categoriesRes.data);
        }

        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const { error } = await supabase.from('rss_sources').insert({
            name: formData.name,
            url: formData.url,
            category_id: formData.category_id || null,
        });

        if (!error) {
            setFormData({ name: '', url: '', category_id: '' });
            setShowForm(false);
            fetchData();
        }
    }

    async function toggleActive(id: string, currentState: boolean) {
        await supabase.from('rss_sources').update({ is_active: !currentState }).eq('id', id);
        fetchData();
    }

    async function deleteSource(id: string) {
        await supabase.from('rss_sources').delete().eq('id', id);
        fetchData();
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">RSS Sources</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-primary text-primary-content px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Add Source
                </button>
            </div>

            {/* Add Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl mb-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Feed URL</label>
                            <input
                                type="url"
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Category</label>
                            <select
                                value={formData.category_id}
                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                            >
                                <option value="">Select category</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="bg-primary text-primary-content px-4 py-2 rounded-lg font-bold">
                            Save
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border">
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Sources List */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
            ) : (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="border-b border-border-light dark:border-border-dark">
                            <tr className="text-left text-xs font-bold text-text-muted uppercase">
                                <th className="p-4">Name</th>
                                <th className="p-4">URL</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sources.map((source) => (
                                <tr key={source.id} className="border-b border-border-light dark:border-border-dark last:border-0">
                                    <td className="p-4 font-medium">{source.name}</td>
                                    <td className="p-4 text-sm text-text-muted truncate max-w-xs">{source.url}</td>
                                    <td className="p-4">
                                        {source.category && (
                                            <span
                                                className="text-xs px-2 py-1 rounded-full"
                                                style={{ backgroundColor: source.category.color + '20', color: source.category.color }}
                                            >
                                                {source.category.name}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => toggleActive(source.id, source.is_active)}
                                            className={`text-xs px-3 py-1 rounded-full font-bold ${source.is_active
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                }`}
                                        >
                                            {source.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => deleteSource(source.id)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {sources.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-text-muted">
                                        No RSS sources yet. Add one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
