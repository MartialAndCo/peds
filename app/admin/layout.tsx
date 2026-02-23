'use client'

import { SidebarAdmin } from "@/components/sidebar-admin"
import Navbar from "@/components/navbar"
import { AgentProvider } from "@/components/agent-provider"
import { usePWAMode } from "@/hooks/use-pwa-mode"
import { PWAShell, PWAHeader, PWATabBar, PWAContent } from "@/components/pwa"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Bot,
    Users,
    Globe,
    TrendingUp,
    ListTodo,
    Mic2,
    Settings,
    Flame
} from "lucide-react"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isPWAStandalone } = usePWAMode()
    const pathname = usePathname()

    // PWA Render
    if (isPWAStandalone) {
        // Dynamic Title based on path
        const segments = pathname.split('/').filter(Boolean)
        const lastSegment = segments[segments.length - 1]
        const displayTitle = lastSegment === 'admin' ? 'Platform Overview' :
            lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)

        const tabs = [
            { label: 'Home', icon: LayoutDashboard, href: '/admin' },
            { label: 'Agents', icon: Bot, href: '/admin/agents' },
            { label: 'Contacts', icon: Users, href: '/admin/contacts' },
            { label: 'System', icon: ListTodo, href: '/admin/system' }, // Monitor
        ]

        const menuItems = [
            {
                title: "Data Management",
                routes: [
                    { label: 'Conversations', icon: Globe, href: '/admin/conversations' },
                    { label: 'Payments', icon: TrendingUp, href: '/admin/payments' },
                    { label: 'Scenarios', icon: Flame, href: '/admin/scenarios' },
                ]
            },
            {
                title: "System Config",
                routes: [
                    { label: 'Voice Library', icon: Mic2, href: '/admin/voices' },
                    { label: 'Settings', icon: Settings, href: '/admin/settings' },
                ]
            }
        ]

        return (
            <AgentProvider>
                <PWAShell variant="admin">
                    {/* <PWAHeader /> Removed for page-specific control */}
                    <PWAContent>
                        {children}
                    </PWAContent>
                    <PWATabBar tabs={tabs} menuItems={menuItems} />
                </PWAShell>
            </AgentProvider>
        )
    }

    // Default Desktop/Web Render
    return (
        <AgentProvider>
            <div className="h-full relative bg-[#0f172a]">
                {/* Fixed Admin Sidebar */}
                <div className="hidden md:flex h-full w-64 flex-col fixed inset-y-0 z-50">
                    <SidebarAdmin />
                </div>

                {/* Main Content Area */}
                <main className="md:pl-64 h-full flex flex-col">
                    <Navbar />
                    <div className="flex-1 p-8 pt-6 overflow-y-auto">
                        {children}
                    </div>
                </main>
            </div>
        </AgentProvider>
    )
}
