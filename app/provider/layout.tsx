'use client'

import { usePWAMode } from "@/hooks/use-pwa-mode"
import { PWAShell, PWAContent, PWATabBar } from "@/components/pwa"
import { usePathname } from "next/navigation"
import { PlusCircle, History, BarChart3, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"

export default function ProviderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isPWAStandalone } = usePWAMode()
    const pathname = usePathname()

    const tabs = [
        { label: 'Add Lead', icon: PlusCircle, href: '/provider/add' },
        { label: 'History', icon: History, href: '/provider/history' },
        { label: 'Dashboard', icon: BarChart3, href: '/provider' },
    ]

    // PWA Render with bottom nav
    if (isPWAStandalone) {
        return (
            <PWAShell variant="provider">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                        <h1 className="text-lg font-semibold text-white">Lead Provider</h1>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="text-slate-400 hover:text-white"
                        >
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </header>
                    
                    <PWAContent className="flex-1 overflow-y-auto">
                        {children}
                    </PWAContent>
                    
                    <PWATabBar tabs={tabs} menuItems={[]} />
                </div>
            </PWAShell>
        )
    }

    // Desktop/Web Render
    return (
        <div className="h-full relative bg-[#0f172a]">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-semibold text-white">Lead Provider Portal</h1>
                <Button 
                    variant="outline" 
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                </Button>
            </header>

            {/* Main Content */}
            <main className="h-[calc(100vh-73px)] flex">
                {/* Sidebar */}
                <nav className="w-64 bg-slate-900 border-r border-slate-800 p-4">
                    <div className="space-y-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = pathname === tab.href
                            return (
                                <a
                                    key={tab.href}
                                    href={tab.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                        isActive 
                                            ? 'bg-blue-600 text-white' 
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{tab.label}</span>
                                </a>
                            )
                        })}
                    </div>
                </nav>

                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}
