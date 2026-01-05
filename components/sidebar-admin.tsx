'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    LayoutDashboard,
    Users,
    Settings,
    Bot,
    LogOut,
    Server,
    ShieldCheck,
    Globe
} from 'lucide-react'

const adminRoutes = [
    {
        title: "Platform",
        routes: [
            { label: 'Global Overview', icon: LayoutDashboard, href: '/admin', color: 'text-sky-500' },
            { label: 'Agent Lobby', icon: Bot, href: '/admin/agents', color: 'text-emerald-500' },
        ]
    },
    {
        title: "Centralized Data",
        routes: [
            { label: 'Global Contacts', icon: Users, href: '/admin/contacts', color: 'text-pink-700' },
            { label: 'Global Conversations', icon: Globe, href: '/admin/conversations', color: 'text-cyan-500' },
        ]
    },
    {
        title: "System Control",
        routes: [
            { label: 'Infrastructure', icon: Server, href: '/admin/system', color: 'text-slate-500' },
            { label: 'Global Settings', icon: Settings, href: '/admin/settings', color: 'text-blue-600' },
            { label: 'Moderation', icon: ShieldCheck, href: '/admin/moderation', color: 'text-red-500' },
        ]
    }
]

export function SidebarAdmin() {
    const pathname = usePathname()

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#0f172a] text-white border-r border-slate-800">
            <div className="px-3 py-2 flex-1 overflow-y-auto">
                <Link href="/admin" className="flex items-center pl-3 mb-10 group">
                    <div className="relative w-10 h-10 mr-4">
                        <div className="absolute inset-0 rounded-full blur opacity-75 bg-gradient-to-r from-cyan-500 to-blue-600 animate-pulse"></div>
                        <div className="relative rounded-full w-full h-full flex items-center justify-center border border-white/10 overflow-hidden bg-slate-900 shadow-inner">
                            <Server className="h-5 w-5 text-cyan-400" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold text-white">PedsAI Admin</h1>
                        <span className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold">System Level</span>
                    </div>
                </Link>

                <div className="space-y-6">
                    {adminRoutes.map((group, groupIndex) => (
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
            <div className="px-3 py-2 border-t border-white/5">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/5"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                >
                    <LogOut className="h-5 w-5 mr-3" />
                    Exit Portal
                </Button>
            </div>
        </div>
    )
}
