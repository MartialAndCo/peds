
'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash, Pencil, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAgent } from '@/components/agent-provider'

export function AgentSettings() {
    const { agents, setSelectedAgent } = useAgent()
    const [localAgents, setLocalAgents] = useState<any[]>([])
    const [prompts, setPrompts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Form State
    const [editingId, setEditingId] = useState<number | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        color: '#000000',
        promptId: '0'
    })

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
            setLoading(false)
        } catch (e) {
            console.error(e)
            setLoading(false)
        }
    }

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
            // Reload to update global context sidebar
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

    if (loading) return <div>Loading personas...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Manage Personas</h3>
                <Button onClick={() => handleOpen()} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Add New Persona
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localAgents.map((agent) => (
                    <Card key={agent.id} className="relative overflow-hidden group hover:border-emerald-500 transition-all cursor-default">
                        <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: agent.color }} />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pl-6">
                            <CardTitle className="text-xl font-bold">{agent.name}</CardTitle>
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm" style={{ backgroundColor: agent.color }}>
                                {agent.name.substring(0, 2).toUpperCase()}
                            </div>
                        </CardHeader>
                        <CardContent className="pl-6 pt-4 space-y-3">
                            <div className="text-sm text-muted-foreground flex items-center">
                                <span className="font-mono bg-slate-100 px-2 py-1 rounded border">{agent.phone || 'No phone'}</span>
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold text-xs uppercase tracking-wider text-slate-500">Prompt:</span>
                                <div className="mt-1 truncate font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    {prompts.find(p => p.id === agent.promptId)?.name || 'Default / None'}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="outline" size="sm" onClick={() => handleOpen(agent)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(agent.id)}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

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
        </div>
    )
}
