'use client'

import { ArrowLeft, Bell, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PWAHeaderProps {
    title: string;
    showBack?: boolean;
    rightAction?: React.ReactNode;
    className?: string;
}

export function PWAHeader({ title, showBack = false, rightAction, className }: PWAHeaderProps) {
    const router = useRouter();

    return (
        <header
            className={cn(
                "h-14 flex items-center justify-between px-4 sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/[0.06]",
                className
            )}
        >
            <div className="flex items-center gap-3">
                {showBack && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -ml-2 text-white/70"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <h1 className="text-lg font-semibold tracking-tight truncate max-w-[200px]">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-2">
                {rightAction}
            </div>
        </header>
    );
}
