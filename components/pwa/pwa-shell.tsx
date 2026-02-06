import { cn } from "@/lib/utils";

interface PWAShellProps {
    children: React.ReactNode;
    className?: string;
    variant?: "workspace" | "admin" | "provider";
}

export function PWAShell({ children, className, variant = "workspace" }: PWAShellProps) {
    return (
        <div
            className={cn(
                "flex flex-col h-full bg-[#0f172a] text-white overflow-hidden overflow-x-hidden",
                "pwa-safe-area-top pwa-safe-area-bottom", // Handle safe areas at root
                className
            )}
        >
            {children}
        </div>
    );
}

export function PWAContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex-1 overflow-y-auto overflow-x-hidden pwa-hide-scrollbar px-5 pb-32", className)}>
            {children}
        </div>
    );
}
