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

    const tabs = [
        { label: 'Overview', icon: LayoutDashboard, href: `/workspace/${agentId}` },
        { label: 'Contacts', icon: Users, href: `/workspace/${agentId}/contacts` },
        { label: 'Chats', icon: MessageSquare, href: `/workspace/${agentId}/conversations` },
        { label: 'Media', icon: ImageIcon, href: `/workspace/${agentId}/media` },
    ]

    const menuItems = [
        {
            title: "Agent Systems",
            routes: [
                { label: 'Connectivity', icon: Zap, href: `/workspace/${agentId}/connection` },
                { label: 'Identity', icon: Fingerprint, href: `/workspace/${agentId}/identity` },
                { label: 'Life Schedule', icon: Clock, href: `/workspace/${agentId}/schedule` },
                { label: 'Settings', icon: Settings, href: `/workspace/${agentId}/settings` },
            ]
        },
        {
            title: "Data",
            routes: [
                { label: 'Queue', icon: Clock, href: `/workspace/${agentId}/queue` },
                { label: 'Payments', icon: TrendingUp, href: `/workspace/${agentId}/payments` },
                { label: 'Moderation', icon: ShieldCheck, href: `/workspace/${agentId}/moderation` },
            ]
        }
    ]

    // Check if we're in a specific conversation (hide tab bar)
    const isInConversation = pathname?.includes('/conversations/') && pathname.split('/').length > 4

    // PWA Render
    if (isPWAStandalone) {
        return (
            <AgentProvider>
                <PWAShell variant="workspace">
                    <PWAContent className={isInConversation ? "pb-0" : ""}>
                        {children}
                    </PWAContent>
                    {!isInConversation && <PWATabBar tabs={tabs} menuItems={menuItems} />}
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
                <main className="md:pl-64 h-full flex flex-col overflow-hidden">
                    <Navbar />
                    <div className="flex-1 overflow-hidden">
                        {children}
                    </div>
                </main>
            </div>
        </AgentProvider>
    )
}
