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
            { label: 'Overview', icon: LayoutDashboard, href: '/admin' },
            { label: 'Agents', icon: Bot, href: '/admin/agents' },
        ]
    },
    {
        title: "Data",
        routes: [
            { label: 'Contacts', icon: Users, href: '/admin/contacts' },
            { label: 'Conversations', icon: Globe, href: '/admin/conversations' },
        ]
    },
    {
        title: "System",
        routes: [
            { label: 'Infrastructure', icon: Server, href: '/admin/system' },
            { label: 'Settings', icon: Settings, href: '/admin/settings' },
            { label: 'Moderation', icon: ShieldCheck, href: '/admin/moderation' },
        ]
    }
]

export function SidebarAdmin() {
    const pathname = usePathname()

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-white/[0.06]">
            {/* Logo */}
            <div className="p-4 border-b border-white/[0.06]">
                <Link href="/admin" className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                        <span className="text-black font-bold text-lg">P</span>
                    </div>
                    <div>
                        <p className="text-white font-semibold text-sm">PedsAI</p>
                        <p className="text-white/40 text-xs">Admin Portal</p>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-4">
                {adminRoutes.map((group, i) => (
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

            {/* Footer */}
            <div className="p-4 border-t border-white/[0.06]">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-white/40 hover:text-white hover:bg-white/[0.04] h-10"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign Out
                </Button>
            </div>
        </div>
    )
}
