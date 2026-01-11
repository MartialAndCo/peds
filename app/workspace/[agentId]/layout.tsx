import { SidebarWorkspace } from "@/components/sidebar-workspace"
import Navbar from "@/components/navbar"
import { AgentProvider } from "@/components/agent-provider"

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode
}) {
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
