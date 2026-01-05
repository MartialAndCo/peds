import { Sidebar } from "@/components/sidebar"
import Navbar from "@/components/navbar"
import { AgentProvider } from "@/components/agent-provider"
import { AgentSwitcher } from "@/components/agent-switcher"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AgentProvider>
            <div className="h-full relative">
                {/* 1. Agent Rail (Leftmost) - 72px */}
                <div className="hidden md:flex h-full w-[72px] z-30 flex-col fixed inset-y-0">
                    <AgentSwitcher />
                </div>

                {/* 2. Main Sidebar (Next to rail) */}
                <div className="hidden md:flex h-full w-60 flex-col fixed inset-y-0 left-[72px] z-20 bg-gray-900 border-l border-gray-800">
                    <Sidebar />
                </div>

                {/* 3. Main Content - Left Padding = 72 + 240 = 312px */}
                <main className="md:pl-[312px] h-full flex flex-col">
                    {/* Dashboard Layout Refreshed */}
                    <Navbar />
                    <div className="flex-1 p-8 pt-0 overflow-y-auto">
                        {children}
                    </div>
                </main>
            </div>
        </AgentProvider>
    )
}
