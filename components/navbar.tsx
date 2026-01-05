'use client'

import { MobileSidebar } from "@/components/mobile-sidebar";
import { usePathname, useParams } from "next/navigation";
import { ChevronRight, Home, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useAgent } from "@/components/agent-provider";
import { cn } from "@/lib/utils";

const Navbar = () => {
    const pathname = usePathname();
    const { agentId } = useParams();
    const { agents } = useAgent();

    const isWorkspace = pathname.startsWith('/workspace');
    const currentAgent = agents.find(a => a.id.toString() === agentId);

    // Breadcrumb logic
    const segments = pathname.split('/').filter(Boolean);

    return (
        <div className="flex items-center p-4 bg-white/50 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
            <MobileSidebar />

            <div className="flex items-center gap-2 ml-4 overflow-hidden">
                <Link href="/admin" className="text-slate-400 hover:text-slate-600 transition">
                    <Home className="h-4 w-4" />
                </Link>

                <ChevronRight className="h-4 w-4 text-slate-300" />

                {isWorkspace ? (
                    <>
                        <div
                            className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-100 border border-slate-200"
                        >
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentAgent?.color || '#3b82f6' }} />
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">
                                {currentAgent?.name || 'Agent'}
                            </span>
                        </div>
                    </>
                ) : (
                    <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">Portal Admin</span>
                )}

                {segments.length > 2 && (
                    <>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                        <span className="text-xs font-medium text-slate-500 capitalize">
                            {segments[segments.length - 1]}
                        </span>
                    </>
                )}
            </div>

            <div className="flex w-full justify-end">
                {/* Future: UserButton */}
            </div>
        </div>
    );
}

export default Navbar;
