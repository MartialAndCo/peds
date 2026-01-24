'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from 'next-auth/react'
import { Loader2, LogOut, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'

export default function WorkspacePortal() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [agents, setAgents] = useState<any[]>([])

    useEffect(() => {
        checkAccess()
    }, [])

    async function checkAccess() {
        try {
            // We use a dedicated endpoint or hijack the profile endpoint to get assigned agents
            // Since we don't have a specific endpoint yet, we'll fetch from /api/agents which typically returns ALL for admin
            // We need a way to filter for THIS user.
            // Let's create a quick client-side filter by fetching profile info first? 
            // Better: Let's assume hitting /api/agents as a collaborator ONLY returns assigned agents.
            // Wait, standard CRUD usually checks permissions.

            // Let's fetch the user's profile which includes agents
            const session = await getSession()
            if (!session) {
                router.push('/login')
                return
            }

            // Simple Fetch
            const res = await fetch('/api/agents') // Needs to be filtered on server side!

            // Actually, let's use a new endpoint /api/workspace/my-agents 
            // OR reuse the fact that non-admins might be restricted by API.
            // For now, let's assume /api/agents needs to return filtered list for collaborators. 
            // I'll update /api/agents/route.ts in next step to support this filtering.

            const data = await res.json()

            // Manually filter using session if API returns all (security risk, but temporary fix)
            // Ideally API filters it.

            // But wait, the user object in session might list them? 
            // No, session usually light.

            // Let's assume data IS filtered for now (I will implement the filtering next).
            setAgents(data)

            // Auto-redirect if only 1 agent
            if (data.length === 1) {
                router.push(`/workspace/${data[0].id}`)
                return
            }

            setIsLoading(false)

        } catch (error) {
            console.error(error)
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white">
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-500" />
                <p className="text-white/50">Loading your workspace...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0f172a] p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Select Workspace</h1>
                        <p className="text-white/40">Choose an agent to manage</p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="text-white/50 hover:text-white"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                    </Button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {agents.map((agent: any) => (
                        <div
                            key={agent.id}
                            onClick={() => router.push(`/workspace/${agent.id}`)}
                            className="bg-[#1e293b] border border-white/5 rounded-2xl p-6 cursor-pointer hover:border-blue-500/50 hover:bg-[#1e293b]/80 transition-all group relative overflow-hidden"
                            style={{
                                boxShadow: `0 0 0 0 ${agent.color}00` // ready for hover effect
                            }}
                        >
                            {/* Color Glow */}
                            <div
                                className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"
                                style={{ backgroundColor: agent.color }}
                            />

                            <div className="relative z-10">
                                <div
                                    className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-lg shadow-lg"
                                    style={{ backgroundColor: agent.color }}
                                >
                                    {agent.name.substring(0, 1)}
                                </div>
                                <h3 className="text-xl font-bold text-white group-hover:text-blue-200 transition-colors">
                                    {agent.name}
                                </h3>
                                <p className="text-white/40 text-sm mt-1 mb-6">
                                    {agent.phone}
                                </p>

                                <div className="flex items-center text-blue-400 text-sm font-medium">
                                    Enter Workspace <MessageCircle className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {agents.length === 0 && (
                    <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                        <p className="text-white/50">No workspaces assigned.</p>
                        <p className="text-white/30 text-sm mt-2">Contact your administrator for access.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
