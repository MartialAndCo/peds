'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
    Plus, Trash, Pencil, Smartphone, Loader2, QrCode, Power, Brain
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AgentConfigEditor } from '@/components/settings/agent-config-editor'

export function AgentSettings() {
    const [localAgents, setLocalAgents] = useState<any[]>([])
    const [prompts, setPrompts] = useState<any[]>([])
    const [statuses, setStatuses] = useState<Record<number, string>>({})
    const [loading, setLoading] = useState(true)

    // Dialog States
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isConnectOpen, setIsConnectOpen] = useState(false)
    const [isConfigOpen, setIsConfigOpen] = useState(false)

    // Selection States
    const [editingAgent, setEditingAgent] = useState<any>(null)
    const [connectingAgent, setConnectingAgent] = useState<any>(null)
    const [configAgent, setConfigAgent] = useState<any>(null)

    // Form State
    const [formData, setFormData] = useState({ name: '', phone: '', color: '#000000', promptId: '' })
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [connectionStatus, setConnectionStatus] = useState('IDLE')

    const fetchAgents = useCallback(async () => {
        try {
            const res = await axios.get('/api/agents')
            setLocalAgents(res.data)
        } catch (e) { console.error(e) }
    }, [])

    const fetchPrompts = useCallback(async () => {
        try {
            const res = await axios.get('/api/prompts')
            setPrompts(res.data)
        } catch (e) { console.error(e) }
    }, [])

    // Poll Statuses
    useEffect(() => {
        const checkStatuses = async () => {
            if (localAgents.length === 0) return
            // For now, we assume if they have a phone, they might be connected. 
            // In a real multi-session WAHA setup, we would query each session.
            // Simplified: If Global WAHA is connected and matches phone, mark connected.
            try {
                const res = await axios.get('/api/waha/status')
                const me = res.data.me
                const newStatuses: any = {}

                localAgents.forEach(a => {
                    if (me && me.id && me.id.includes(a.phone)) {
                        newStatuses[a.id] = 'CONNECTED'
                    } else {
                        newStatuses[a.id] = 'DISCONNECTED'
                    }
                })
                setStatuses(newStatuses)
            } catch (e) { console.error(e) }
        }

        checkStatuses()
        const interval = setInterval(checkStatuses, 10000)
        return () => clearInterval(interval)
    }, [localAgents])

    useEffect(() => {
        Promise.all([fetchAgents(), fetchPrompts()]).then(() => setLoading(false))
    }, [fetchAgents, fetchPrompts])

    const handleOpen = (agent?: any) => {
        if (agent) {
            setEditingAgent(agent)
            setFormData({
                name: agent.name,
                phone: agent.phone,
                color: agent.color,
                promptId: agent.promptId?.toString() || ''
            })
        } else {
            setEditingAgent(null)
            setFormData({ name: '', phone: '', color: generateRandomColor(), promptId: '' })
        }
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        try {
            if (editingAgent) {
                await axios.put(`/api/agents/${editingAgent.id}`, formData)
            } else {
                await axios.post('/api/agents', formData)
            }
            setIsDialogOpen(false)
            fetchAgents()
        } catch (e) {
            alert('Failed to save agent')
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? This cannot be undone.')) return
        await axios.delete(`/api/agents/${id}`)
        fetchAgents()
    }

    // Connection Logic (Simplified for now - assumes Single Session or directs to main QR)
    const openConnectionDialog = (agent: any) => {
        setConnectingAgent(agent)
        setIsConnectOpen(true)
        setConnectionStatus('LOADING')
        // In a real multi-session setup, we would start a specific session for this agent.
        // For now, we simulate check or just show instructions.
        setQrCode('/api/waha/qr') // Default global QR
        setConnectionStatus('SCAN_QR')
    }

    const handleDisconnect = async (id: number) => {
        if (!confirm("Disconnect this agent?")) return
        await axios.post('/api/session/stop') // Global stop for now
        fetchAgents()
    }

    const generateRandomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16)

    if (loading) return <Loader2 className="animate-spin" />

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Manage Personas & Connections</h3>
                <Button onClick={() => handleOpen()} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Add New Persona
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localAgents.map((agent) => {
                    const status = statuses[agent.id] || 'UNKNOWN'
                    const isConnected = status === 'CONNECTED'

                    return (
                        <Card key={agent.id} className="relative overflow-hidden group hover:border-emerald-500 transition-all cursor-default flex flex-col justify-between">
                            <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: agent.color }} />

                            <div>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pl-6">
                                    <CardTitle className="text-xl font-bold">{agent.name}</CardTitle>
                                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm" style={{ backgroundColor: agent.color }}>
                                        {agent.name.substring(0, 2).toUpperCase()}
                                    </div>
                                </CardHeader>
                                <CardContent className="pl-6 pt-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-mono bg-slate-100 px-2 py-1 rounded border text-sm">{agent.phone || 'No phone'}</span>
                                        <Badge variant={isConnected ? 'default' : 'outline'} className={isConnected ? "bg-green-600 hover:bg-green-700" : "text-slate-500"}>
                                            {isConnected ? 'On Air' : 'Offline'}
                                        </Badge>
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-semibold text-xs uppercase tracking-wider text-slate-500">Prompt:</span>
                                        <div className="mt-1 truncate font-medium flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                            {prompts.find(p => p.id === agent.promptId)?.name || 'Custom / Default'}
                                        </div>
                                    </div>
                                </CardContent>
                            </div>

                            <div className="p-4 pl-6 pt-0 flex justify-between items-end">
                                <Button
                                    variant={isConnected ? "secondary" : "default"}
                                    size="sm"
                                    className={isConnected ? "w-28 text-red-600 hover:text-red-700 hover:bg-red-50" : "w-28 bg-emerald-600 hover:bg-emerald-700"}
                                    onClick={() => isConnected ? handleDisconnect(agent.id) : openConnectionDialog(agent)}
                                >
                                    {isConnected ? <><Power className="mr-2 h-4 w-4" /> Stop</> : <><QrCode className="mr-2 h-4 w-4" /> Connect</>}
                                </Button>

                                <div className="flex gap-1 opacity-100 transition-opacity">
                                    <Button variant="outline" size="icon" onClick={() => { setConfigAgent(agent); setIsConfigOpen(true) }} title="Configure Prompts & Brain">
                                        <Brain className="h-4 w-4 text-purple-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpen(agent)}>
                                        <Pencil className="h-4 w-4 text-slate-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(agent.id)}>
                                        <Trash className="h-4 w-4 text-red-400" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )
                })}
            </div>

            {/* CREATE / EDIT DIALOG */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAgent ? 'Edit Persona' : 'Create New Persona'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Lena" />
                        </div>
                        <div className="space-y-2">
                            <Label>WhatsApp Number</Label>
                            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="e.g. 33612345678" />
                        </div>
                        <div className="space-y-2">
                            <Label>Color Identity</Label>
                            <div className="flex gap-2">
                                <Input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-12 h-10 p-1" />
                                <Input value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Persona</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CONNECTION DIALOG */}
            <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Connect {connectingAgent?.name}</DialogTitle>
                        <DialogDescription>Scan this QR code with the WhatsApp account for {connectingAgent?.phone}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        {connectionStatus === 'SCAN_QR' && qrCode && (
                            <img src={qrCode} alt="QR Code" className="w-64 h-64 border-4 border-slate-900 rounded-xl" />
                        )}
                        <p className="text-sm text-slate-500 text-center">Open WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device</p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* BRAIN CONFIG DIALOG */}
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto">
                    {configAgent && <AgentConfigEditor agent={configAgent} onClose={() => setIsConfigOpen(false)} />}
                </DialogContent>
            </Dialog>
        </div>
    )
}
