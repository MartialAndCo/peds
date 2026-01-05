'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import QRCode from 'qrcode'
import { Plus, Trash, Pencil, Smartphone, Loader2, QrCode, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAgent } from '@/components/agent-provider'
import { Badge } from '@/components/ui/badge'

export function AgentSettings() {
    const { agents, setSelectedAgent } = useAgent()
    const [localAgents, setLocalAgents] = useState<any[]>([])
    const [prompts, setPrompts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // CRUD Dialog
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        color: '#000000',
        promptId: '0'
    })

    // Connection Dialog
    const [isConnectOpen, setIsConnectOpen] = useState(false)
    const [connectingAgent, setConnectingAgent] = useState<any>(null)
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
    const [connectionStatus, setConnectionStatus] = useState<string>('STARTING')
    const [statuses, setStatuses] = useState<Record<number, string>>({})

    // Poll Ref
    const pollInterval = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [agentsRes, promptsRes] = await Promise.all([
                axios.get('/api/agents'),
                axios.get('/api/prompts')
            ])
            setLocalAgents(agentsRes.data)
            setPrompts(promptsRes.data)

            // Initial status check for all agents
            agentsRes.data.forEach((ag: any) => checkStatus(ag.id))

            setLoading(false)
        } catch (e) {
            console.error(e)
            setLoading(false)
        }
    }

    const checkStatus = async (id: number) => {
        try {
            const res = await axios.get(`/api/agents/${id}/status`)
            setStatuses(prev => ({ ...prev, [id]: res.data.status || 'UNKNOWN' }))
        } catch (e) {
            setStatuses(prev => ({ ...prev, [id]: 'UNKNOWN' }))
        }
    }

    // --- CRUD ---

    const handleOpen = (agent?: any) => {
        if (agent) {
            setEditingId(agent.id)
            setFormData({
                name: agent.name,
                phone: agent.phone || '',
                color: agent.color || '#000000',
                promptId: agent.promptId?.toString() || '0'
            })
        } else {
            setEditingId(null)
            setFormData({ name: '', phone: '', color: '#000000', promptId: '0' })
        }
        setIsDialogOpen(true)
    }

    const handleSubmit = async () => {
        try {
            const payload = {
                ...formData,
                promptId: formData.promptId === '0' ? null : parseInt(formData.promptId)
            }

            if (editingId) {
                await axios.put(`/api/agents/${editingId}`, payload)
            } else {
                await axios.post('/api/agents', payload)
            }

            setIsDialogOpen(false)
            fetchData()
            window.location.reload()
        } catch (e) {
            alert('Failed to save agent')
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? This action cannot be undone.')) return
        try {
            await axios.delete(`/api/agents/${id}`)
            fetchData()
            window.location.reload()
        } catch (e) {
            alert('Failed to delete agent')
        }
    }

    // --- CONNECTION FLOW ---

    const openConnectionDialog = (agent: any) => {
        setConnectingAgent(agent)
        setQrCodeUrl(null)
        setConnectionStatus('STARTING')
        setIsConnectOpen(true)

        // Start Session immediately
        startSession(agent.id)
    }

    const startSession = async (id: number) => {
        try {
            await axios.post(`/api/agents/${id}/status`) // POST triggers start
            // Start polling
            if (pollInterval.current) clearInterval(pollInterval.current)
            pollInterval.current = setInterval(() => pollStatus(id), 2000)
        } catch (e) {
            console.error(e)
            setConnectionStatus('ERROR')
        }
    }

    const pollStatus = async (id: number) => {
        try {
            const res = await axios.get(`/api/agents/${id}/status`)
            const { status, qr } = res.data
            setConnectionStatus(status)

            if (qr) {
                const url = await QRCode.toDataURL(qr)
                setQrCodeUrl(url)
            }

            if (status === 'CONNECTED') {
                if (pollInterval.current) clearInterval(pollInterval.current)
                // Refresh list status
                checkStatus(id)
                // Close dialog after delay
                setTimeout(() => setIsConnectOpen(false), 2000)
            }
        } catch (e) {
            console.error('Poll failed', e)
        }
    }

    const handleDisconnect = async (id: number) => {
        if (!confirm("Disconnect this WhatsApp session?")) return
        try {
            await axios.delete(`/api/agents/${id}/status`)
            checkStatus(id)
        } catch (e) {
            alert("Failed to disconnect")
        }
    }

    // Cleanup poll
    useEffect(() => {
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current)
        }
    }, [])

    const closeConnectDialog = () => {
        if (pollInterval.current) clearInterval(pollInterval.current)
        setIsConnectOpen(false)
    }


    if (loading) return <div>Loading personas...</div>

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
                                            {prompts.find(p => p.id === agent.promptId)?.name || 'Default / None'}
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

                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

            {/* EDIT DIALOG */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Persona' : 'Create New Persona'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Persona Name</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Lena, Maxime..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone Number (WhatsApp)</Label>
                            <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="33612345678" />
                            <p className="text-xs text-muted-foreground">The actual phone number connected to WhatsApp.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Theme Color</Label>
                            <div className="flex gap-2 items-center">
                                <Input type="color" className="w-12 h-10 p-1 cursor-pointer" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                <Input value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="font-mono uppercase flex-1" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Linked System Prompt</Label>
                            <Select value={formData.promptId} onValueChange={val => setFormData({ ...formData, promptId: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a prompt" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Default / None</SelectItem>
                                    {prompts.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Determines the personality of this agent.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit}>{editingId ? 'Save Changes' : 'Create Persona'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CONNECTION DIALOG */}
            <Dialog open={isConnectOpen} onOpenChange={closeConnectDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Connect {connectingAgent?.name}</DialogTitle>
                        <DialogDescription>
                            Open WhatsApp on your phone, go to Linked Devices, and scan the QR code.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        {connectionStatus === 'CONNECTED' ? (
                            <div className="flex flex-col items-center text-emerald-600 animate-in zoom-in spin-in-1">
                                <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                                    <Smartphone className="h-10 w-10" />
                                </div>
                                <h3 className="text-xl font-bold">Connected Successfully!</h3>
                                <p className="text-sm text-muted-foreground">Redirecting...</p>
                            </div>
                        ) : (
                            <>
                                {qrCodeUrl ? (
                                    <div className="relative border-4 border-slate-900 rounded-lg p-2 bg-white shadow-xl animate-in fade-in zoom-in duration-500">
                                        <img src={qrCodeUrl} alt="Scan QR Code" className="w-64 h-64" />
                                        <div className="absolute -bottom-6 w-full text-center text-xs font-mono text-muted-foreground">
                                            Reloading in... usually fast
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 w-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                                        <Loader2 className="h-10 w-10 animate-spin text-slate-400 mb-2" />
                                        <p className="text-xs text-muted-foreground">Generating Session...</p>
                                    </div>
                                )}

                                <div className="text-center space-y-1">
                                    <p className="font-medium text-sm">Status: {connectionStatus}</p>
                                    <p className="text-xs text-muted-foreground">Session ID: {connectingAgent?.id}</p>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
