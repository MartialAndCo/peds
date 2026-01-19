'use client'

import { SidebarWorkspace } from "@/components/sidebar-workspace"
import Navbar from "@/components/navbar"
import { AgentProvider } from "@/components/agent-provider"
import { usePWAMode } from "@/hooks/use-pwa-mode"
import { PWAShell, PWAHeader, PWATabBar, PWAContent } from "@/components/pwa"
import { useParams, usePathname } from "next/navigation"
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Image as ImageIcon,
    Zap,
    Clock,
    TrendingUp,
    Fingerprint,
    Settings,
    ShieldCheck
} from "lucide-react"

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isPWAStandalone } = usePWAMode()
    const { agentId } = useParams()
    const pathname = usePathname()

    // PWA Render
    if (isPWAStandalone) {
        // Dynamic Title based on path
        const segments = pathname.split('/').filter(Boolean)
        const lastSegment = segments[segments.length - 1]
        const displayTitle = lastSegment === agentId ? 'Overview' :
            lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)

        const baseUrl = `/workspace/${agentId}`

        const tabs = [
            { label: 'Home', icon: LayoutDashboard, href: `${baseUrl}` },
            { label: 'Chat', icon: MessageSquare, href: `${baseUrl}/conversations` },
            { label: 'Contacts', icon: Users, href: `${baseUrl}/contacts` },
            { label: 'Media', icon: ImageIcon, href: `${baseUrl}/media` },
        ]

        const menuItems = [
            {
                title: "Performance",
                routes: [
                    { label: 'Pipeline', icon: Zap, href: `${baseUrl}/pipeline` },
                    { label: 'Queue', icon: Clock, href: `${baseUrl}/queue` },
                    { label: 'Payments', icon: TrendingUp, href: `${baseUrl}/payments` },
                ]
            },
            {
                title: "Configuration",
                routes: [
                    { label: 'Identity', icon: Fingerprint, href: `${baseUrl}/identity` },
                    { label: 'Connectivity', icon: Zap, href: `${baseUrl}/connection` },
                    { label: 'Settings', icon: Settings, href: `${baseUrl}/settings` },
                    { label: 'Moderation', icon: ShieldCheck, href: `${baseUrl}/moderation` },
                ]
            }
        ]

        return (
            <AgentProvider>
                <PWAShell variant="workspace">
                    <PWAHeader title={displayTitle} showBack={lastSegment !== agentId} />
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
                {/* Fixed Workspace Sidebar */}
                <div className="hidden md:flex h-full w-64 flex-col fixed inset-y-0 z-50">
                    <SidebarWorkspace />
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
