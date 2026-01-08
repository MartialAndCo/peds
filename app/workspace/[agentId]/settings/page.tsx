'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trash } from 'lucide-react'

export default function AgentSettingsPage() {
    const { agentId } = useParams()
    const [agent, setAgent] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const [formData, setFormData] = useState({ name: '', color: '' })

    useEffect(() => {
        axios.get('/api/agents').then(res => {
            const found = res.data.find((a: any) => a.id.toString() === agentId)
            setAgent(found)
            if (found) setFormData({ name: found.name, color: found.color })
            setLoading(false)
        }).catch(e => setLoading(false))
    }, [agentId])

    const handleUpdate = async () => {
        await axios.put(`/api/agents/${agentId}`, formData)
        alert('Updated')
        window.location.reload()
    }

    const handleDelete = async () => {
        if (!confirm('EXTREME DANGER: Deleting an agent will orphan their conversations. Continue?')) return
        await axios.delete(`/api/agents/${agentId}`)
        router.push('/admin/agents')
    }

    if (loading) return <Loader2 className="animate-spin" />
    if (!agent) return <div>Agent not found</div>

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-red-900/80">Administrative Settings</h1>
                <p className="text-slate-500">Danger zone.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Cosmetic Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Agent Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Color Brand</Label>
                        <div className="flex gap-2">
                            <Input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-12 h-10 p-1" />
                            <Input value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                        </div>
                    </div>
                    <Button onClick={handleUpdate}>Update Appearance</Button>
                </CardContent>
            </Card>

            <VoiceSelector agent={agent} />

            <Card className="border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="text-red-800">Delete Agent</CardTitle>
                    <CardDescription className="text-red-600">This action cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" onClick={handleDelete}>
                        <Trash className="mr-2 h-4 w-4" /> Delete {agent.name}
                    </Button>
                </CardContent>
            </Card>
        </div >
    )
}

function VoiceSelector({ agent }: { agent: any }) {
    const [voices, setVoices] = useState<any[]>([])
    const [selectedVoice, setSelectedVoice] = useState(agent.voiceModelId || '')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        axios.get('/api/voices').then(res => setVoices(res.data)).catch(() => { })
    }, [])

    const handleSave = async () => {
        setLoading(true)
        try {
            await axios.put(`/api/agents/${agent.id}`, { voiceModelId: selectedVoice })
            alert('Voice updated!')
        } catch (e) {
            alert('Error updating voice')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Voice Identity</CardTitle>
                <CardDescription>Select the voice model used for audio generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>RVC Model</Label>
                    <select
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedVoice}
                        onChange={e => setSelectedVoice(e.target.value)}
                    >
                        <option value="">-- No Voice (Use Default) --</option>
                        {voices.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>
                <Button onClick={handleSave} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Voice'}
                </Button>
            </CardContent>
        </Card>
    )
}
