'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trash } from 'lucide-react'

export default function AgentSettingsPage({ params }: { params: { agentId: string } }) {
    const [agent, setAgent] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const [formData, setFormData] = useState({ name: '', color: '' })

    useEffect(() => {
        const id = params.agentId
        axios.get('/api/agents').then(res => {
            const found = res.data.find((a: any) => a.id.toString() === id)
            setAgent(found)
            if (found) setFormData({ name: found.name, color: found.color })
            setLoading(false)
        }).catch(e => setLoading(false))
    }, [params.agentId])

    const handleUpdate = async () => {
        await axios.put(`/api/agents/${params.agentId}`, formData)
        alert('Updated')
        window.location.reload()
    }

    const handleDelete = async () => {
        if (!confirm('EXTREME DANGER: Deleting an agent will orphan their conversations. Continue?')) return
        await axios.delete(`/api/agents/${params.agentId}`)
        router.push('/agents')
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
        </div>
    )
}
