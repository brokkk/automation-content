import { useState, useEffect } from 'react';

interface HeaderProps {
    title?: string;
    onSearch?: (query: string) => void;
    onNewPost?: () => void;
}

export function Header({
    title = 'Pipeline Dashboard',
    onSearch,
    onNewPost
}: HeaderProps) {
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const toggleTheme = () => setIsDark(!isDark);

    return (
        <header className="h-14 flex items-center justify-between px-6 border-b border-main bg-main">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold tracking-tight text-main">{title}</h2>
            </div>

            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-muted group-focus-within:text-primary transition-colors text-[18px]">
                            search
                        </span>
                    </div>
                    <input
                        className="block w-56 pl-9 pr-3 py-1.5 border border-main rounded-full leading-5 bg-surface text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all"
                        placeholder="Search content..."
                        type="text"
                        onChange={(e) => onSearch?.(e.target.value)}
                    />
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-full hover:bg-surface transition-colors text-main theme-toggle"
                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    <span className="material-symbols-outlined text-[20px]">
                        {isDark ? 'light_mode' : 'dark_mode'}
                    </span>
                </button>
            </div>
        </header>
    );
}
