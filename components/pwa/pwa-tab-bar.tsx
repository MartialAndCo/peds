'use client'

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon, MoreHorizontal } from "lucide-react";
import { PWAMenuSheet, MenuItem } from "./pwa-menu-sheet";

export interface TabItem {
    label: string;
    icon: LucideIcon;
    href: string;
}

interface PWATabBarProps {
    tabs: TabItem[];
    menuItems: {
        title: string;
        routes: MenuItem[];
    }[];
}

export function PWATabBar({ tabs, menuItems }: PWATabBarProps) {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Should show active state for tabs if current path starts with tab href (simple logic)
    // But for "home", exact match is better usually.
    // Let's do: exact match for home, startsWith for others?
    const isActive = (href: string) => {
        if (href.endsWith('/conversations') && pathname.includes('/conversations')) return true;
        if (href.endsWith('/contacts') && pathname.includes('/contacts')) return true;
        if (href.endsWith('/media') && pathname.includes('/media')) return true;
        if (href === pathname) return true; // Exact match for others (like dashboard)
        return false;
    };

    // Hide the tab bar completely inside conversation views so it doesn't block the message input
    const isConversationDetail = pathname.match(/\/conversations\/[a-zA-Z0-9_-]+/);
    if (isConversationDetail) return null;

    return (
        <>
            <nav className="fixed bottom-6 left-4 right-4 z-50 rounded-3xl bg-[#0f172a]/80 backdrop-blur-2xl border border-white/10 shadow-lg shadow-black/50 pwa-safe-area-bottom">
                <div className="flex items-center justify-around h-16 px-2">
                    {tabs.map((tab) => {
                        const active = isActive(tab.href);
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="flex-1 flex flex-col items-center justify-center h-full gap-1 active:scale-90 transition-all duration-200"
                            >
                                <div className={cn(
                                    "p-2 rounded-2xl transition-all duration-300",
                                    active ? "bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "text-white/40"
                                )}>
                                    <tab.icon className={cn("h-6 w-6 transition-transform", active && "scale-110")} />
                                </div>
                            </Link>
                        )
                    })}

                    {/* More Button */}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="flex-1 flex flex-col items-center justify-center h-full gap-1 active:scale-90 transition-all duration-200"
                    >
                        <div className="p-2 rounded-2xl text-white/40">
                            <MoreHorizontal className="h-6 w-6" />
                        </div>
                    </button>
                </div>
            </nav>

            <PWAMenuSheet
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                items={menuItems}
            />
        </>
    );
}
