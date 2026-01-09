'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Trash, Sparkles, BookOpen, Scale, Palette, RefreshCcw } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
        <div className="max-w-4xl space-y-8 pb-32">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Agent Settings</h1>
                <p className="text-white/60">Configure personality, voice, and behavior for {agent.name}.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Core Identity */}
                <div className="space-y-8">
                    <Card className="glass h-fit">
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Agent Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="glass-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Brand Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={formData.color}
                                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                                        className="w-12 h-10 p-1 glass-input cursor-pointer"
                                    />
                                    <Input
                                        value={formData.color}
                                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                                        className="glass-input uppercase"
                                    />
                                </div>
                            </div>
                            <Button onClick={handleUpdate} className="w-full glass-btn">
                                Save Appearance
                            </Button>
                        </CardContent>
                    </Card>

                    <VoiceSelector agent={agent} />

                    <Card className="border-red-900/30 bg-red-950/10">
                        <CardHeader>
                            <CardTitle className="text-red-400 text-sm">Danger Zone</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button variant="destructive" onClick={handleDelete} className="w-full text-xs">
                                <Trash className="mr-2 h-3 w-3" /> Delete Agent
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Prompt Engineering */}
                <div className="md:col-span-2">
                    <PromptManager agentId={String(agentId)} />
                </div>
            </div>
        </div>
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
        <Card className="glass">
            <CardHeader>
                <CardTitle>Voice Identity</CardTitle>
                <CardDescription>RVC Model & Source Gender</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <Label className="text-xs text-white/60 uppercase">Operator Gender</Label>
                    <Select value={operatorGender} onValueChange={setOperatorGender}>
                        <SelectTrigger className="glass-input">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-popover">
                            <SelectItem value="MALE">Male (Homme)</SelectItem>
                            <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <Label className="text-xs text-white/60 uppercase">Target Voice Model</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger className="glass-input">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-popover max-h-60 overflow-y-auto">
                            <SelectItem value="default" className="italic opacity-50">-- Use Default --</SelectItem>
                            {voices.map(v => (
                                <SelectItem key={v.id} value={v.id.toString()}>
                                    {v.name} <span className="text-[10px] opacity-50 ml-1">({v.gender})</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full glass-btn">
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Voice'}
                </Button>
            </CardContent>
        </Card>
    )
}

function PromptManager({ agentId }: { agentId: string }) {
    const [agentSettings, setAgentSettings] = useState<Record<string, string>>({})
    const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Fetch Setup
    useEffect(() => {
        axios.get(`/api/agents/${agentId}/settings`)
            .then(res => {
                setAgentSettings(res.data.agentSettings)
                setGlobalSettings(res.data.globalSettings)
                setLoading(false)
            })
            .catch(err => {
                console.error("Failed to load prompt settings", err)
                setLoading(false)
            })
    }, [agentId])

    const handleChange = (key: string, val: string) => {
        setAgentSettings(prev => ({ ...prev, [key]: val }))
    }

    const handleReset = (key: string) => {
        setAgentSettings(prev => {
            const next = { ...prev }
            delete next[key]
            return next
        })
    }

    const handleSave = async () => {
        setSaving(true)
        // Convert empty strings to null/undefined/empty to trigger delete on backend if needed,
        // but backend logic handles "value: String(value)".
        // Backend handles empty strings by DELETING if value === ''
        // wait, let's verify my backend logic. 
        // Logic: if (value === null || value === '' || value === undefined) -> deleteMany
        // So sending '' is correct to remove override.

        try {
            await axios.put(`/api/agents/${agentId}/settings`, agentSettings)
            alert('Prompt settings saved successfully!') // Or use a toast
        } catch (e) {
            alert('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-white/30" /></div>

    return (
        <Card className="glass relative overflow-hidden min-h-[600px]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl">Personality & Behavior</CardTitle>
                        <CardDescription>Override global prompts to customize this agent.</CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg shadow-white/10">
                        {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="identity" className="w-full">
                    <TabsList className="bg-white/5 border border-white/10 w-full justify-start p-1 mb-6">
                        <TabsTrigger value="identity" className="data-[state=active]:bg-white/10"><UserIcon className="w-4 h-4 mr-2" /> Identity</TabsTrigger>
                        <TabsTrigger value="phases" className="data-[state=active]:bg-white/10"><BookOpen className="w-4 h-4 mr-2" /> Phases</TabsTrigger>
                        <TabsTrigger value="rules" className="data-[state=active]:bg-white/10"><Scale className="w-4 h-4 mr-2" /> Rules</TabsTrigger>
                        <TabsTrigger value="style" className="data-[state=active]:bg-white/10"><Palette className="w-4 h-4 mr-2" /> Style</TabsTrigger>
                    </TabsList>

                    <TabsContent value="identity" className="space-y-6">
                        <PromptField
                            label="Identity Template"
                            description="Who is the agent? (Name, Age, Backstory). Use {{ROLE}} to include base role."
                            objKey="prompt_identity_template"
                            agentVal={agentSettings['prompt_identity_template']}
                            globalVal={globalSettings['prompt_identity_template']}
                            onChange={handleChange}
                            onReset={handleReset}
                            rows={8}
                        />
                        <PromptField
                            label="Context Template"
                            description="How the agent sees the user. Use {{USER_NAME}}, {{DAYS_ACTIVE}}."
                            objKey="prompt_context_template"
                            agentVal={agentSettings['prompt_context_template']}
                            globalVal={globalSettings['prompt_context_template']}
                            onChange={handleChange}
                            onReset={handleReset}
                            rows={6}
                        />
                        <PromptField
                            label="Mission Template"
                            description="The high-level goal structure. Usually contains {{DYNAMIC_GOAL_BLOCK}}."
                            objKey="prompt_mission_template"
                            agentVal={agentSettings['prompt_mission_template']}
                            globalVal={globalSettings['prompt_mission_template']}
                            onChange={handleChange}
                            onReset={handleReset}
                            rows={6}
                        />
                    </TabsContent>

                    <TabsContent value="phases" className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <PromptField
                                label="Phase A: Connection (Seduction)"
                                description="Initial phase. Goal: Hook the user, be engaging."
                                objKey="phase_prompt_connection"
                                agentVal={agentSettings['phase_prompt_connection']}
                                globalVal={globalSettings['phase_prompt_connection']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                            <PromptField
                                label="Phase B: Vulnerability (Confidences)"
                                description="After ~3 days. Goal: Share secrets, create emotional bond."
                                objKey="phase_prompt_vulnerability"
                                agentVal={agentSettings['phase_prompt_vulnerability']}
                                globalVal={globalSettings['phase_prompt_vulnerability']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                            <PromptField
                                label="Phase C: Crisis (Urgent Help)"
                                description="High Trust. Goal: Create urgency for a specific problem."
                                objKey="phase_prompt_crisis"
                                agentVal={agentSettings['phase_prompt_crisis']}
                                globalVal={globalSettings['phase_prompt_crisis']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                            <PromptField
                                label="Phase D: MoneyPot (Retention)"
                                description="Paid users. Goal: Long-term relationship maintenance."
                                objKey="phase_prompt_moneypot"
                                agentVal={agentSettings['phase_prompt_moneypot']}
                                globalVal={globalSettings['phase_prompt_moneypot']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="rules" className="space-y-6">
                        <PromptField
                            label="Global Rules"
                            description="Critical instructions that apply everywhere."
                            objKey="prompt_global_rules"
                            agentVal={agentSettings['prompt_global_rules']}
                            globalVal={globalSettings['prompt_global_rules']}
                            onChange={handleChange}
                            onReset={handleReset}
                            rows={5}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <PromptField
                                label="Social Media Rules"
                                objKey="prompt_social_media_rules"
                                agentVal={agentSettings['prompt_social_media_rules']}
                                globalVal={globalSettings['prompt_social_media_rules']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                            <PromptField
                                label="Image Handling Rules"
                                objKey="prompt_image_handling_rules"
                                agentVal={agentSettings['prompt_image_handling_rules']}
                                globalVal={globalSettings['prompt_image_handling_rules']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                            <PromptField
                                label="Payment Rules"
                                objKey="prompt_payment_rules"
                                agentVal={agentSettings['prompt_payment_rules']}
                                globalVal={globalSettings['prompt_payment_rules']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                            <PromptField
                                label="Voice Note Policy"
                                objKey="prompt_voice_note_policy"
                                agentVal={agentSettings['prompt_voice_note_policy']}
                                globalVal={globalSettings['prompt_voice_note_policy']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={4}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="style" className="space-y-6">
                        <PromptField
                            label="Style Instructions"
                            description="Language, tone, emojis, length constraints."
                            objKey="prompt_style_instructions"
                            agentVal={agentSettings['prompt_style_instructions']}
                            globalVal={globalSettings['prompt_style_instructions']}
                            onChange={handleChange}
                            onReset={handleReset}
                            rows={8}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <PromptField
                                label="View Once Refusal"
                                objKey="msg_view_once_refusal"
                                agentVal={agentSettings['msg_view_once_refusal']}
                                globalVal={globalSettings['msg_view_once_refusal']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={3}
                            />
                            <PromptField
                                label="Voice Refusal"
                                objKey="msg_voice_refusal"
                                agentVal={agentSettings['msg_voice_refusal']}
                                globalVal={globalSettings['msg_voice_refusal']}
                                onChange={handleChange}
                                onReset={handleReset}
                                rows={3}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}

function PromptField({ label, description, objKey, agentVal, globalVal, onChange, onReset, rows = 3 }: any) {
    const isOverridden = agentVal !== undefined && agentVal !== null && agentVal !== ''
    // If agentVal exists, show it. If not, show empty string (controlled input). 
    // Placeholder handles global val.
    const currentValue = agentVal || ''

    return (
        <div className="space-y-2 p-4 rounded-xl transition-all duration-300 border border-white/5 hover:border-white/10 bg-white/[0.02]">
            <div className="flex justify-between items-start">
                <div>
                    <Label className={`text-sm font-medium ${isOverridden ? 'text-blue-300' : 'text-white/70'}`}>
                        {label} {isOverridden && <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Overridden</span>}
                    </Label>
                    {description && <p className="text-[11px] text-white/40 mt-0.5">{description}</p>}
                </div>
                {isOverridden && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReset(objKey)}
                        title="Reset to global default"
                        className="h-6 w-6 p-0 hover:bg-white/10 text-white/40 hover:text-red-400"
                    >
                        <RefreshCcw className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            <div className="relative group">
                <Textarea
                    value={currentValue}
                    onChange={(e) => onChange(objKey, e.target.value)}
                    placeholder={globalVal || "(No global default set)"}
                    rows={rows}
                    className={`glass-input text-sm font-light leading-relaxed resize-y min-h-[${rows * 1.5}rem] 
                        ${isOverridden ? 'border-l-2 border-l-blue-500/50 pl-3' : 'opacity-80'}`}
                />
                {!isOverridden && globalVal && (
                    <div className="absolute top-2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-white/20 bg-black/40 px-2 py-1 rounded">Using Global Default</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function UserIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
