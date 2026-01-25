'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { Plus, Loader2, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export default function AgentsLobbyPage() {
    const [agents, setAgents] = useState<any[]>([])
    const [agentStatuses, setAgentStatuses] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newAgent, setNewAgent] = useState({ name: '', phone: '' })

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await axios.get('/api/agents')
            const agentsData = Array.isArray(res.data) ? res.data : []
            setAgents(agentsData)
            fetchStatuses(agentsData)
        } catch (e) {
            console.error(e)
            setAgents([])
        } finally {
            setLoading(false)
        }
    }

    const fetchStatuses = async (agentsList: any[]) => {
        if (!Array.isArray(agentsList) || agentsList.length === 0) return
        try {
            const statuses: Record<string, string> = {}
            // Fetch status for each agent individually
            await Promise.all(agentsList.map(async (agent) => {
                try {
                    const res = await axios.get(`/api/waha/status?agentId=${agent.id}`)
                    const status = res.data.status
                    statuses[agent.id] = status === 'WORKING' ? 'ONLINE' :
                        status === 'SCAN_QR_CODE' ? 'PENDING' : 'OFFLINE'
                } catch {
                    statuses[agent.id] = 'OFFLINE'
                }
            }))
            setAgentStatuses(statuses)
        } catch (e) {
            console.error('Failed to fetch statuses:', e)
        }
    }

    const handleCreate = async () => {
        if (!newAgent.name) return
        try {
            await axios.post('/api/agents', newAgent)
            setIsCreateOpen(false)
            fetchAgents()
            setNewAgent({ name: '', phone: '' })
        } catch (e) {
            console.error('Error creating agent')
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-6 w-6 text-white/40" />
        </div>
    )

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Agents</h1>
                    <p className="text-white/40 text-sm mt-1">
                        Select an agent to manage
                    </p>
                </div>
                <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-white text-black hover:bg-white/90"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    New Agent
                </Button>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agents.map((agent) => {
                    const status = agentStatuses[agent.id] || 'OFFLINE'
                    const isOnline = status === 'ONLINE'
                    const isPending = status === 'PENDING'

                    // Status colors
                    const statusStyles = isOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isPending
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'

                    return (
                        <Link
                            key={agent.id}
                            href={`/workspace/${agent.id}`}
                            className="glass rounded-2xl p-5 hover:bg-white/[0.06] transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-white/[0.08] flex items-center justify-center">
                                    <span className="text-white font-semibold">
                                        {agent.name.substring(0, 2).toUpperCase()}
                                    </span>
                                </div>
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles}`}>
                                    {isOnline ? (
                                        <Wifi className="h-3 w-3" />
                                    ) : (
                                        <WifiOff className="h-3 w-3" />
                                    )}
                                    {isOnline ? 'Online' : isPending ? 'Scanning' : 'Offline'}
                                </div>
                            </div>

                            <h3 className="text-white font-medium group-hover:text-white transition-colors">
                                {agent.name}
                            </h3>
                            <p className="text-white/30 text-sm font-mono mt-1">
                                {agent.phone || 'No phone configured'}
                            </p>
                        </Link>
                    )
                })}
            </div>

            {/* Empty State / Debug */}
            {agents.length === 0 && (
                <div className="glass rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                        <Plus className="h-6 w-6 text-white/20" />
                    </div>
                    <p className="text-white font-medium mb-2">No agents found</p>
                    <p className="text-white/40 text-sm mb-6">
                        {loading ? 'Loading...' : 'Create your first AI agent to get started'}
                    </p>
                    <div className="text-xs text-white/20 font-mono mb-4">
                        Debug: Loaded {agents.length} agents. Status: {loading ? 'Loading' : 'Idle'}
                    </div>
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-white text-black hover:bg-white/90"
                    >
                        Create Agent
                    </Button>
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="bg-[#1e293b] border-white/[0.08]">
                    <DialogHeader>
                        <DialogTitle className="text-white">Create Agent</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-white/60 text-sm">Name</label>
                            <Input
                                value={newAgent.name}
                                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                                placeholder="Agent name"
                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-white/60 text-sm">Phone Number (Optional)</label>
                            <Input
                                value={newAgent.phone}
                                onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                                placeholder="+33..."
                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={handleCreate}
                            className="bg-white text-black hover:bg-white/90"
                        >
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
