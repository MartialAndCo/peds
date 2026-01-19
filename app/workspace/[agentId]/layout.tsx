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
        return (
            <AgentProvider>
                <PWAShell variant="workspace">
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
