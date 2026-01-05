'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    Bot,
    LogOut,
    Beaker,
    Image,
    List,
    Server
} from 'lucide-react'

const routeGroups = [
    {
        title: "Main",
        routes: [
            { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', color: 'text-sky-500' },
            { label: 'Agents', icon: Bot, href: '/agents', color: 'text-emerald-500' },
            { label: 'Conversations', icon: MessageSquare, href: '/conversations', color: 'text-green-700' },
            { label: 'Queue', icon: List, href: '/queue', color: 'text-yellow-500' },
        ]
    },
    {
        title: "CRM",
        routes: [
            { label: 'Contacts', icon: Users, href: '/contacts', color: 'text-pink-700' },
            { label: 'Cercle Privé', icon: Users, href: '/dashboard/profiles', color: 'text-amber-500' },
            { label: 'Media', icon: Image, href: '/media', color: 'text-purple-500' },
        ]
    },
    {
        title: "Intelligence",
        routes: [
            { label: 'Settings', icon: Settings, href: '/settings', color: 'text-slate-500' },
            { label: 'Sandbox', icon: Beaker, href: '/sandbox', color: 'text-orange-500' },
            // Prompts hidden as requested - effectively archiving
        ]
    },
    {
        title: "System",
        routes: [
            { label: 'System', icon: Server, href: '/system', color: 'text-cyan-500' },
        ]
    }
]

import { useWahaStatus } from "@/components/waha-status-provider";
import { useAgent } from "@/components/agent-provider";

export function Sidebar() {
    const pathname = usePathname()
    const { isDisconnected } = useWahaStatus()
    const { selectedAgent } = useAgent()

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
            <div className="px-3 py-2 flex-1 overflow-y-auto">
                <Link href="/dashboard" className="flex items-center pl-3 mb-10">
                    <div className="relative w-8 h-8 mr-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 rounded-full blur opacity-75 animate-pulse"></div>
                        <div
                            className="relative rounded-full w-full h-full flex items-center justify-center border border-white/10 overflow-hidden"
                            style={{ backgroundColor: selectedAgent?.color || '#000000' }}
                        >
                            <span className="text-sm font-bold">
                                {selectedAgent?.name?.substring(0, 2).toUpperCase() || 'P'}
                            </span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold text-white truncate max-w-[150px]">
                        {selectedAgent?.name || 'PedsAI'}
                    </h1>
                </Link>

                <div className="space-y-6">
                    {routeGroups.map((group, groupIndex) => (
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
                                            "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                            pathname === route.href ? "text-white bg-white/10" : "text-zinc-400"
                                        )}
                                    >
                                        <div className="flex items-center flex-1">
                                            <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                            {route.label}
                                            {route.label === 'Settings' && isDisconnected && (
                                                <span className="ml-auto bg-red-500 w-2 h-2 rounded-full animate-pulse" title="WhatsApp Disconnected" />
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="px-3 py-2">
                <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                >
                    <LogOut className="h-5 w-5 mr-3" />
                    Logout
                </Button>
            </div>
        </div>
    )
}
