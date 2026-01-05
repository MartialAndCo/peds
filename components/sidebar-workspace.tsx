'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    LayoutDashboard,
    MessageSquare,
    Fingerprint,
    Zap,
    Settings,
    ArrowLeft,
    TrendingUp
} from 'lucide-react'
import { useAgent } from '@/components/agent-provider'

export function SidebarWorkspace() {
    const pathname = usePathname()
    const { agentId } = useParams()
    const { agents } = useAgent()

    // Find agent for UI polish
    const currentAgent = agents.find(a => a.id.toString() === agentId)
    const baseUrl = `/workspace/${agentId}`

    const workspaceRoutes = [
        {
            title: "Performance",
            routes: [
                { label: 'Overview', icon: LayoutDashboard, href: `${baseUrl}`, color: 'text-sky-500' },
                { label: 'Conversation Hub', icon: MessageSquare, href: `${baseUrl}/conversations`, color: 'text-green-500' },
            ]
        },
        {
            title: "Configuration",
            routes: [
                { label: 'Identity & Persona', icon: Fingerprint, href: `${baseUrl}/identity`, color: 'text-purple-500' },
                { label: 'Connectivity', icon: Zap, href: `${baseUrl}/connection`, color: 'text-amber-500' },
                { label: 'Agent Settings', icon: Settings, href: `${baseUrl}/settings`, color: 'text-slate-400' },
            ]
        }
    ]

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#020617] text-white border-r border-slate-800">
            <div className="px-3 py-2 flex-1 overflow-y-auto">
                <Link href="/admin/agents" className="flex items-center pl-3 mb-8 group text-slate-400 hover:text-white transition">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">Back to Agents</span>
                </Link>

                <div className="px-3 mb-10">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg border border-white/10"
                            style={{ backgroundColor: currentAgent?.color || '#3b82f6' }}
                        >
                            {currentAgent?.name?.substring(0, 2).toUpperCase() || 'A'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold truncate max-w-[120px]">{currentAgent?.name || 'Agent Workspace'}</span>
                            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Active</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {workspaceRoutes.map((group, groupIndex) => (
                        <div key={groupIndex}>
                            <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {group.routes.map((route) => (
                                    <Link
                                        key={route.href}
                                        href={route.href}
                                        className={cn(
                                            "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/5 rounded-lg transition",
                                            pathname === route.href ? "text-white bg-white/10" : "text-zinc-400"
                                        )}
                                    >
                                        <div className="flex items-center flex-1">
                                            <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                            {route.label}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
