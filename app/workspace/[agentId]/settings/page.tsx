'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trash } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
    const [selectedVoice, setSelectedVoice] = useState(agent.voiceModelId?.toString() || 'default')
    const [operatorGender, setOperatorGender] = useState(agent.operatorGender || 'MALE')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        axios.get('/api/voices').then(res => setVoices(res.data)).catch(() => { })
    }, [])

    const handleSave = async () => {
        setLoading(true)
        try {
            await axios.put(`/api/agents/${agent.id}`, {
                voiceModelId: selectedVoice === 'default' ? null : parseInt(selectedVoice),
                operatorGender
            })
            alert('Voice settings updated!')
        } catch (e) {
            alert('Error updating voice')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="glass overflow-visible">
            <CardHeader>
                <CardTitle>Voice Identity</CardTitle>
                <CardDescription>Configure how the agent speaks and who is operating it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <Label className="text-sm font-medium opacity-70">Operator Gender (Source)</Label>
                        <Select value={operatorGender} onValueChange={setOperatorGender}>
                            <SelectTrigger className="glass w-full border-white/10 hover:bg-white/5 transition-colors">
                                <SelectValue placeholder="Select Gender" />
                            </SelectTrigger>
                            <SelectContent className="glass-strong border-white/10 text-white">
                                <SelectItem value="MALE">Male (Homme)</SelectItem>
                                <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-slate-500 leading-relaxed italic">Helps RVC calculate pitch correction (e.g. Male -&gt; Female needs +12 pitch).</p>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-sm font-medium opacity-70">RVC Model (Target)</Label>
                        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                            <SelectTrigger className="glass w-full border-white/10 hover:bg-white/5 transition-colors">
                                <SelectValue placeholder="Select Voice Model" />
                            </SelectTrigger>
                            <SelectContent className="glass-strong border-white/10 text-white max-h-60 overflow-y-auto">
                                <SelectItem value="default" className="italic opacity-70 text-xs">-- No Voice (Use Default) --</SelectItem>
                                {voices.map(v => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        <div className="flex items-center gap-2">
                                            <span>{v.name}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 opacity-50 uppercase">{v.gender || 'FEMALE'}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                    <Button onClick={handleSave} disabled={loading} className="w-full md:w-auto glass-strong hover:bg-white/10 border-white/10 transition-all font-semibold">
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Apply Voice Settings'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
