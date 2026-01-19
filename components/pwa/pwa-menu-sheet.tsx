'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

export interface MenuItem {
    label: string;
    icon: LucideIcon;
    href: string;
}

interface PWAMenuSheetProps {
    isOpen: boolean;
    onClose: () => void;
    items: {
        title: string;
        routes: MenuItem[];
    }[];
}

export function PWAMenuSheet({ isOpen, onClose, items }: PWAMenuSheetProps) {
    const pathname = usePathname();

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[20px] p-0 border-white/10 bg-[#0f172a] overflow-hidden">
                <SheetHeader className="p-4 border-b border-white/10">
                    <SheetTitle className="text-white">More Options</SheetTitle>
                </SheetHeader>

                <div className="overflow-y-auto h-full pb-20 p-4">
                    {items.map((group, i) => (
                        <div key={i} className="mb-6">
                            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                                {group.title}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {group.routes.map((route) => {
                                    const isActive = pathname === route.href;
                                    return (
                                        <Link
                                            key={route.href}
                                            href={route.href}
                                            onClick={onClose}
                                            className={cn(
                                                "flex flex-col items-center justify-center p-4 rounded-xl gap-2 transition-all",
                                                isActive
                                                    ? "bg-white/10 text-white"
                                                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            <route.icon className="h-6 w-6" />
                                            <span className="text-xs font-medium">{route.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
