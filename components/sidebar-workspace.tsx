'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    MessageSquare,
    Fingerprint,
    Zap,
    Settings,
    ArrowLeft
} from 'lucide-react'
import { useAgent } from '@/components/agent-provider'

export function SidebarWorkspace() {
    const pathname = usePathname()
    const { agentId } = useParams()
    const { agents } = useAgent()

    const currentAgent = agents.find(a => a.id.toString() === agentId)
    const baseUrl = `/workspace/${agentId}`

    const workspaceRoutes = [
        {
            title: "Performance",
            routes: [
                { label: 'Overview', icon: LayoutDashboard, href: `${baseUrl}` },
                { label: 'Conversations', icon: MessageSquare, href: `${baseUrl}/conversations` },
            ]
        },
        {
            title: "Configuration",
            routes: [
                { label: 'Identity', icon: Fingerprint, href: `${baseUrl}/identity` },
                { label: 'Connectivity', icon: Zap, href: `${baseUrl}/connection` },
                { label: 'Settings', icon: Settings, href: `${baseUrl}/settings` },
            ]
        }
    ]

    return (
        <div className="flex flex-col h-full bg-[#0f172a] border-r border-white/[0.06]">
            {/* Back Link */}
            <div className="p-4 border-b border-white/[0.06]">
                <Link
                    href="/admin/agents"
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="font-medium">Back to Agents</span>
                </Link>
            </div>

            {/* Agent Info */}
            <div className="p-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                            {currentAgent?.name?.substring(0, 2).toUpperCase() || 'AG'}
                        </span>
                    </div>
                    <div>
                        <p className="text-white font-semibold text-sm truncate max-w-[140px]">
                            {currentAgent?.name || 'Agent'}
                        </p>
                        <p className="text-white/40 text-xs">Workspace</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-4">
                {workspaceRoutes.map((group, i) => (
                    <div key={i} className="mb-6">
                        <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                            {group.title}
                        </p>
                        <div className="space-y-0.5 px-2">
                            {group.routes.map((route) => {
                                const isActive = pathname === route.href
                                return (
                                    <Link
                                        key={route.href}
                                        href={route.href}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                            isActive
                                                ? "bg-white/[0.08] text-white"
                                                : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                                        )}
                                    >
                                        <route.icon className="h-4 w-4" />
                                        {route.label}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
