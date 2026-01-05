'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard,
    Fingerprint, // Identity
    Radio, // Connection
    Settings, // Settings
    Mic, // Voice
    ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export default function AgentLayout({
    children,
    params
}: {
    children: React.ReactNode
    params: { agentId: string }
}) {
    const [agent, setAgent] = useState<any>(null)
    const pathname = usePathname()
    const router = useRouter()
    const id = params.agentId

    useEffect(() => {
        // Fetch minimal agent info for the sidebar
        axios.get('/api/agents').then(res => {
            const found = res.data.find((a: any) => a.id.toString() === id)
            if (found) setAgent(found)
        }).catch(console.error)
    }, [id])

    const navItems = [
        { label: 'Overview', href: `/agents/${id}`, icon: LayoutDashboard },
        { label: 'Identity', href: `/agents/${id}/identity`, icon: Fingerprint },
        { label: 'Connection', href: `/agents/${id}/connection`, icon: Radio },
        { label: 'Settings', href: `/agents/${id}/settings`, icon: Settings },
    ]

    return (
        <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-slate-50">
            {/* AGENT SIDEBAR */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/agents')} className="text-slate-500 mb-4 -ml-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to Lobby
                    </Button>

                    {agent ? (
                        <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: agent.color }}>
                                {agent.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800">{agent.name}</h2>
                                <p className="text-xs text-slate-400">Agent ID: {id}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-pulse h-10 w-32 bg-slate-100 rounded"></div>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <item.icon className={cn("mr-3 h-5 w-5", isActive ? "text-slate-300" : "text-slate-400")} />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                        <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">Status</h4>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-sm font-medium text-emerald-700">Active</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    )
}
