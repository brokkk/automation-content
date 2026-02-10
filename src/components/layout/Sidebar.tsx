import type { NavItem } from '../types';

const navigation: NavItem[] = [
    { name: 'Overview', icon: 'pie_chart', href: '/' },
    { name: 'Content Pipeline', icon: 'view_kanban', href: '/', isActive: true },
    { name: 'RSS Sources', icon: 'rss_feed', href: '/sources' },
    { name: 'Platform Settings', icon: 'tune', href: '/platforms' },
    { name: 'Image Generator', icon: 'image', href: '/images' },
    { name: 'Test Pipeline', icon: 'science', href: '/test' },
];

const bottomNav: NavItem[] = [
    { name: 'Telegram', icon: 'send', href: '/telegram' },
    { name: 'Settings', icon: 'settings', href: '/settings' },
];

interface SidebarProps {
    activeItem?: string;
}

export function Sidebar({ activeItem = 'Content Pipeline' }: SidebarProps) {
    return (
        <aside className="w-64 flex-shrink-0 border-r border-main bg-main flex flex-col justify-between transition-colors duration-200">
            <div className="p-6">
                {/* Brand */}
                <div className="flex items-center gap-3 mb-10">
                    <div className="bg-primary aspect-square rounded-xl size-10 flex items-center justify-center text-primary-content shadow-[0_0_15px_rgba(140,232,48,0.3)]">
                        <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-main">AI Auto</h1>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-1">
                    {navigation.map((item) => {
                        const isActive = item.name === activeItem;
                        return (
                            <a
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                                    ? 'bg-primary/15 text-primary font-semibold'
                                    : 'text-muted hover:bg-surface hover:text-main'
                                    }`}
                            >
                                <span className="material-symbols-outlined">{item.icon}</span>
                                <span className="text-sm font-medium">{item.name}</span>
                            </a>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Actions */}
            <div className="p-6 border-t border-main">
                {bottomNav.map((item) => (
                    <a
                        key={item.name}
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted hover:bg-surface hover:text-main transition-colors"
                    >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span className="text-sm font-medium">{item.name}</span>
                    </a>
                ))}

                {/* User Profile */}
                <div className="mt-4 flex items-center gap-3 px-3">
                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        AM
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-main">Alex Morgan</span>
                        <span className="text-[10px] text-muted">Pro Plan</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
