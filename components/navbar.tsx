'use client'

import { MobileSidebar } from "@/components/mobile-sidebar";
import { usePathname, useParams } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { useAgent } from "@/components/agent-provider";

const Navbar = () => {
    const pathname = usePathname();
    const { agentId } = useParams();
    const { agents } = useAgent();

    const isWorkspace = pathname.startsWith('/workspace');
    const currentAgent = agents.find(a => a.id.toString() === agentId);

    // Path to readable label mapping
    const PATH_LABELS: Record<string, string> = {
        'connection': 'Connectivity',
        'identity': 'Identity',
        'settings': 'Settings',
        'conversations': 'Conversations',
        'agents': 'Agents',
        'contacts': 'Contacts',
        'media': 'Media',
        'prompts': 'Prompts',
        'queue': 'Queue',
        'sandbox': 'Sandbox',
        'system': 'System'
    }

    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1]
    const isAgentId = lastSegment === agentId
    const displayLabel = isAgentId ? 'Overview' : (PATH_LABELS[lastSegment] || lastSegment)

    return (
        <div className="flex items-center h-14 px-4 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-40">
            <MobileSidebar />

            <div className="flex items-center gap-2 ml-4">
                <Link href="/admin" className="text-white/40 hover:text-white transition-colors">
                    <Home className="h-4 w-4" />
                </Link>

                {isWorkspace ? (
                    <>
                        <ChevronRight className="h-3 w-3 text-white/20" />
                        <span className="text-white/60 text-sm font-medium">
                            {currentAgent?.name || 'Agent'}
                        </span>
                        {segments.length > 2 && (
                            <>
                                <ChevronRight className="h-3 w-3 text-white/20" />
                                <span className="text-white text-sm font-medium">
                                    {displayLabel}
                                </span>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <ChevronRight className="h-3 w-3 text-white/20" />
                        <span className="text-white text-sm font-medium">
                            {segments.length > 1 ? PATH_LABELS[segments[1]] || segments[1] : 'Dashboard'}
                        </span>
                    </>
                )}
            </div>

            <div className="flex-1" />
        </div>
    );
}

export default Navbar;
