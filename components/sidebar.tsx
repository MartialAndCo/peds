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
    Beaker
} from 'lucide-react'

const routes = [
    {
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/dashboard',
        color: 'text-sky-500',
    },
    {
        label: 'Prompts',
        icon: Bot,
        href: '/prompts',
        color: 'text-violet-500',
    },
    {
        label: 'Contacts',
        icon: Users,
        href: '/contacts',
        color: 'text-pink-700',
    },
    {
        label: 'Conversations',
        icon: MessageSquare,
        href: '/conversations',
        color: 'text-green-700',
    },
    {
        label: 'Settings',
        icon: Settings,
        href: '/settings',
    },
    {
        label: 'Sandbox',
        icon: Beaker, // You'll need to import Beaker from lucide-react
        href: '/sandbox',
        color: 'text-orange-500',
    },
]

import { useWahaStatus } from "@/components/waha-status-provider";

export function Sidebar() {
    const pathname = usePathname()
    const { isDisconnected } = useWahaStatus()

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
            <div className="px-3 py-2 flex-1">
                <Link href="/dashboard" className="flex items-center pl-3 mb-14">
                    <h1 className="text-2xl font-bold">
                        AutoWhatsApp
                    </h1>
                </Link>
                <div className="space-y-1">
                    {routes.map((route) => (
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
