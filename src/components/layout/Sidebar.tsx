import { useLocation, Link } from 'react-router-dom';

interface NavItem {
    name: string;
    icon: string;
    href: string;
}

const navigation: NavItem[] = [
    { name: 'Content Pipeline', icon: 'view_kanban', href: '/' },
    { name: 'RSS Sources', icon: 'rss_feed', href: '/sources' },
    { name: 'Platform Settings', icon: 'tune', href: '/platforms' },
    { name: 'Image Generator', icon: 'image', href: '/images' },
    { name: 'Test Pipeline', icon: 'science', href: '/test' },
];

const bottomNav: NavItem[] = [
    { name: 'Telegram', icon: 'send', href: '/telegram' },
];

export function Sidebar() {
    const location = useLocation();

    const isActive = (href: string) => {
        if (href === '/') return location.pathname === '/';
        return location.pathname.startsWith(href);
    };

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
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active
                                    ? 'bg-primary/15 text-primary font-semibold'
                                    : 'text-muted hover:bg-surface hover:text-main'
                                    }`}
                            >
                                <span className="material-symbols-outlined">{item.icon}</span>
                                <span className="text-sm font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Actions */}
            <div className="p-6 border-t border-main">
                {bottomNav.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active
                                ? 'bg-primary/15 text-primary font-semibold'
                                : 'text-muted hover:bg-surface hover:text-main'
                                }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </aside>
    );
}
