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
            <div className="h-full relative bg-[#020617]">
                {/* Fixed Workspace Sidebar */}
                <div className="hidden md:flex h-full w-64 flex-col fixed inset-y-0 z-50">
                    <SidebarWorkspace />
                </div>

                {/* Main Content Area */}
                <main className="md:pl-64 h-full flex flex-col">
                    <Navbar />
                    <div className="flex-1 p-8 pt-4 overflow-y-auto bg-slate-50/5 rounded-tl-3xl border-t border-l border-white/5">
                        {children}
                    </div>
                </main>
            </div>
        </AgentProvider>
    )
}
