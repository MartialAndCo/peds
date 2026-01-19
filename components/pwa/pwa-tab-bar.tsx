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

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a]/95 backdrop-blur-2xl border-t border-white/10 pwa-safe-area-bottom">
                <div className="flex items-center justify-around h-16">
                    {tabs.map((tab) => {
                        const active = isActive(tab.href);
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="flex-1 flex flex-col items-center justify-center h-full gap-1 active:scale-95 transition-transform"
                            >
                                <div className={cn(
                                    "p-1.5 rounded-full transition-colors",
                                    active ? "bg-white/10 text-white" : "text-white/40"
                                )}>
                                    <tab.icon className="h-5 w-5" />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-medium tracking-wide",
                                    active ? "text-white" : "text-white/40"
                                )}>
                                    {tab.label}
                                </span>
                            </Link>
                        )
                    })}

                    {/* More Button */}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="flex-1 flex flex-col items-center justify-center h-full gap-1 active:scale-95 transition-transform"
                    >
                        <div className="p-1.5 rounded-full text-white/40">
                            <MoreHorizontal className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-medium tracking-wide text-white/40">
                            More
                        </span>
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
