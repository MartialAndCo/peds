'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AgentsLobbyPage() {
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newAgent, setNewAgent] = useState({ name: '', phone: '', color: '#10b981' })
    const router = useRouter()

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await axios.get('/api/agents')
            setAgents(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!newAgent.name) return
        try {
            await axios.post('/api/agents', newAgent)
            setIsCreateOpen(false)
            fetchAgents()
            setNewAgent({ name: '', phone: '', color: '#10b981' })
        } catch (e) {
            alert('Error creating agent')
        }
    }

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 pt-10">
            <div className="flex flex-col space-y-2">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Agent Lobby</h1>
                <p className="text-slate-500 text-lg">Select an agent to enter their dedicated workspace.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* CREATE CARD */}
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="group relative flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer"
                >
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-emerald-200 transition-colors mb-4">
                        <Plus className="h-8 w-8 text-slate-400 group-hover:text-emerald-700" />
                    </div>
                    <span className="font-semibold text-slate-500 group-hover:text-emerald-800">Create New Agent</span>
                </button>

                {/* AGENT CARDS */}
                {agents.map((agent) => (
                    <Link key={agent.id} href={`/workspace/${agent.id}/overview`} className="block">
                        <Card className="h-64 relative overflow-hidden group hover:shadow-xl transition-all border-slate-200 hover:border-slate-300">
                            <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: agent.color }} />

                            <CardContent className="h-full flex flex-col items-center justify-center p-6 space-y-4">
                                <div
                                    className="h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md transition-transform group-hover:scale-110"
                                    style={{ backgroundColor: agent.color }}
                                >
                                    {agent.name.substring(0, 2).toUpperCase()}
                                </div>

                                <div className="text-center space-y-1">
                                    <h3 className="text-xl font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{agent.name}</h3>
                                    <p className="text-sm text-slate-400 font-mono">{agent.phone || 'No Phone'}</p>
                                </div>

                                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-medium">Enter Workspace &rarr;</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hire a New Agent</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="Agent Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                <Input type="color" value={newAgent.color} onChange={(e) => setNewAgent({ ...newAgent, color: e.target.value })} className="w-12 h-10 p-1" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>WhatsApp Number (Optional)</Label>
                            <Input value={newAgent.phone} onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })} placeholder="e.g. 336..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreate}>Create Agent</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
