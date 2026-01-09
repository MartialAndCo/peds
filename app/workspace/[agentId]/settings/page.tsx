'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, Trash, User, Fingerprint, Mic2, Shield, Palette, AlertOctagon, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type Agent = {
    id: number
    name: string
    color: string
    voiceModelId: number | null
    operatorGender: string
}

export default function AgentSettingsPage() {
    const { agentId } = useParams()
    const router = useRouter()
    const [agent, setAgent] = useState<Agent | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Data States
    const [formData, setFormData] = useState({ name: '', color: '' })
    const [promptSettings, setPromptSettings] = useState<Record<string, string>>({})
    const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({})

    // Voice State
    const [voices, setVoices] = useState<any[]>([])
    const [voiceState, setVoiceState] = useState({ modelId: 'default', gender: 'MALE' })

    // Init Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [agentRes, promptsRes, voicesRes] = await Promise.all([
                    axios.get('/api/agents'),
                    axios.get(`/api/agents/${agentId}/settings`),
                    axios.get('/api/voices')
                ])

                const found = agentRes.data.find((a: any) => a.id.toString() === agentId)
                if (found) {
                    setAgent(found)
                    setFormData({ name: found.name, color: found.color })
                    setVoiceState({
                        modelId: found.voiceModelId?.toString() || 'default',
                        gender: found.operatorGender || 'MALE'
                    })
                }

                setPromptSettings(promptsRes.data.agentSettings)
                setGlobalSettings(promptsRes.data.globalSettings)
                setVoices(voicesRes.data)
            } catch (e) {
                console.error("Init Error", e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [agentId])


    // Handlers
    const handleSaveAll = async () => {
        setSaving(true)
        try {
            await axios.put(`/api/agents/${agentId}`, {
                ...formData,
                voiceModelId: voiceState.modelId === 'default' ? null : parseInt(voiceState.modelId),
                operatorGender: voiceState.gender
            })

            await axios.put(`/api/agents/${agentId}/settings`, promptSettings)
            // toast.success("Saved")
        } catch (e) {
            console.error(e)
            alert("Error saving settings")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('This will permanently delete the agent. Are you sure?')) return
        await axios.delete(`/api/agents/${agentId}`)
        router.push('/admin/agents')
    }

    if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
    if (!agent) return <div className="text-white">Agent not found</div>

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header - Matching Conversations Page Style */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tighter text-white italic">Agent Settings</h2>
                    <p className="text-white/40 text-sm mt-1">Configure persona, phases, and core behavior.</p>
                </div>

                <Button
                    onClick={handleSaveAll}
                    disabled={saving}
                    className="bg-white text-black hover:bg-white/90 font-bold uppercase tracking-widest text-[11px]"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Configuration
                </Button>
            </div>

            {/* Main Tabs Container */}
            <Tabs defaultValue="identity" className="w-full space-y-6">
                <div className="glass p-1 rounded-xl inline-flex w-full md:w-auto">
                    <TabsList className="bg-transparent h-12 w-full justify-start gap-1">
                        <StyledTabTrigger value="identity" icon={User} label="Identity" />
                        <StyledTabTrigger value="phases" icon={Fingerprint} label="Phases" />
                        <StyledTabTrigger value="rules" icon={Shield} label="Rules" />
                        <StyledTabTrigger value="style" icon={Palette} label="Style" />
                        <StyledTabTrigger value="voice" icon={Mic2} label="Voice" />
                    </TabsList>
                </div>

                {/* --- TAB: IDENTITY --- */}
                <TabsContent value="identity" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left Col: Basics */}
                        <div className="glass rounded-2xl p-6 space-y-6 h-fit">
                            <h3 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Core Attributes</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-white/50 tracking-wider">Name</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="bg-white/5 border-white/10 text-white focus:border-white/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-white/50 tracking-wider">Brand Color</Label>
                                    <div className="flex gap-3">
                                        <div
                                            className="w-10 h-10 rounded border border-white/10 shadow-inner"
                                            style={{ backgroundColor: formData.color }}
                                        />
                                        <Input
                                            value={formData.color}
                                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                                            className="bg-white/5 border-white/10 text-white font-mono uppercase focus:border-white/20"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Col: Prompts */}
                        <div className="md:col-span-2 space-y-6">
                            <PromptCard
                                label="Identity Template"
                                description="The agent's backstory, age, and core role definition."
                                value={promptSettings['prompt_identity_template']}
                                globalValue={globalSettings['prompt_identity_template']}
                                onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_identity_template: v })}
                                minHeight="min-h-[200px]"
                            />
                            <PromptCard
                                label="Context Awareness"
                                description="How the agent analyzes the current conversation state."
                                value={promptSettings['prompt_context_template']}
                                globalValue={globalSettings['prompt_context_template']}
                                onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_context_template: v })}
                            />
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB: PHASES --- */}
                <TabsContent value="phases" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PhaseCard
                            title="Phase A: Connection"
                            subtitle="Seduction & Discovery"
                            color="text-blue-400"
                            borderColor="border-blue-500/20"
                            value={promptSettings['phase_prompt_connection']}
                            globalValue={globalSettings['phase_prompt_connection']}
                            onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_prompt_connection: v })}
                        />
                        <PhaseCard
                            title="Phase B: Vulnerability"
                            subtitle="Confidences & Bonding"
                            color="text-purple-400"
                            borderColor="border-purple-500/20"
                            value={promptSettings['phase_prompt_vulnerability']}
                            globalValue={globalSettings['phase_prompt_vulnerability']}
                            onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_prompt_vulnerability: v })}
                        />
                        <PhaseCard
                            title="Phase C: Crisis"
                            subtitle="Urgency & Help"
                            color="text-amber-400"
                            borderColor="border-amber-500/20"
                            value={promptSettings['phase_prompt_crisis']}
                            globalValue={globalSettings['phase_prompt_crisis']}
                            onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_prompt_crisis: v })}
                        />
                        <PhaseCard
                            title="Phase D: MoneyPot"
                            subtitle="Retention & Maintenance"
                            color="text-emerald-400"
                            borderColor="border-emerald-500/20"
                            value={promptSettings['phase_prompt_moneypot']}
                            globalValue={globalSettings['phase_prompt_moneypot']}
                            onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_prompt_moneypot: v })}
                        />
                    </div>
                </TabsContent>

                {/* --- TAB: RULES --- */}
                <TabsContent value="rules" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <PromptCard
                        label="Global Rules & Guardrails"
                        value={promptSettings['prompt_global_rules']}
                        globalValue={globalSettings['prompt_global_rules']}
                        onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_global_rules: v })}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PromptCard
                            label="Image Handling Rules"
                            value={promptSettings['prompt_image_handling_rules']}
                            globalValue={globalSettings['prompt_image_handling_rules']}
                            onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_image_handling_rules: v })}
                        />
                        <PromptCard
                            label="Payment Rules"
                            value={promptSettings['prompt_payment_rules']}
                            globalValue={globalSettings['prompt_payment_rules']}
                            onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_payment_rules: v })}
                        />
                    </div>
                </TabsContent>

                {/* --- TAB: STYLE --- */}
                <TabsContent value="style" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <PromptCard
                        label="Style & Tone Instructions"
                        description="Emoji usage, message length, and linguistic tics."
                        value={promptSettings['prompt_style_instructions']}
                        globalValue={globalSettings['prompt_style_instructions']}
                        onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_style_instructions: v })}
                        minHeight="min-h-[300px]"
                    />
                </TabsContent>

                {/* --- TAB: VOICE --- */}
                <TabsContent value="voice" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass rounded-2xl p-6 space-y-6">
                            <h3 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Voice Engine</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-white/50 tracking-wider">Operator Source Gender</Label>
                                    <Select value={voiceState.gender} onValueChange={(v) => setVoiceState({ ...voiceState, gender: v })}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MALE">Male (Homme)</SelectItem>
                                            <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-white/50 tracking-wider">RVC Model</Label>
                                    <Select value={voiceState.modelId} onValueChange={(v) => setVoiceState({ ...voiceState, modelId: v })}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default" className="text-muted-foreground">-- Default --</SelectItem>
                                            {voices.map(v => (
                                                <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <PromptCard
                                label="Voice Note Policy"
                                description="Under what conditions should the agent send a voice note?"
                                value={promptSettings['prompt_voice_note_policy']}
                                globalValue={globalSettings['prompt_voice_note_policy']}
                                onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_voice_note_policy: v })}
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Danger Zone - Always visible at bottom, distinct style */}
            <div className="mt-12 pt-8 border-t border-white/5">
                <div className="flex justify-between items-center opacity-50 hover:opacity-100 transition-opacity">
                    <div>
                        <h4 className="text-sm font-bold text-red-500/80 uppercase tracking-widest">Danger Zone</h4>
                        <p className="text-xs text-white/30 mt-1">Irreversible actions.</p>
                    </div>
                    <Button variant="destructive" onClick={handleDelete} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20">
                        <Trash className="w-3 h-3 mr-2" /> Delete Agent
                    </Button>
                </div>
            </div>
        </div>
    )
}

// --- SUBCOMPONENTS ---

function StyledTabTrigger({ value, icon: Icon, label }: any) {
    return (
        <TabsTrigger
            value={value}
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 hover:text-white/80 transition-all uppercase text-[10px] font-bold tracking-widest px-6 h-full rounded-lg gap-2"
        >
            <Icon className="w-3 h-3" /> {label}
        </TabsTrigger>
    )
}

function PromptCard({ label, description, value, globalValue, onChange, minHeight = "min-h-[120px]" }: any) {
    const isOverridden = value !== undefined && value !== null && value !== ''

    return (
        <div className={cn(
            "glass rounded-xl p-0 overflow-hidden group transition-all duration-300",
            isOverridden ? "border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "border-white/5"
        )}>
            <div className="bg-white/5 border-b border-white/5 px-4 py-3 flex justify-between items-center">
                <div>
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isOverridden ? "text-blue-400" : "text-white/40"
                    )}>
                        {label}
                    </span>
                    {description && <p className="text-[10px] text-white/30 hidden group-hover:block transition-all">{description}</p>}
                </div>
                {isOverridden && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-red-500/20 hover:text-red-400 text-white/20"
                        onClick={() => onChange('')}
                        title="Reset to Global"
                    >
                        <Trash className="w-3 h-3" />
                    </Button>
                )}
            </div>
            <div className="relative">
                {!isOverridden && (
                    <div className="absolute inset-0 p-4 pointer-events-none opacity-20 text-[11px] font-mono leading-relaxed overflow-hidden">
                        {globalValue || "(No global default)"}
                    </div>
                )}
                <Textarea
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className={cn(
                        "w-full bg-transparent border-0 rounded-none focus-visible:ring-0 p-4 text-xs font-mono leading-relaxed resize-y min-h-[120px]",
                        minHeight,
                        isOverridden ? "text-white bg-blue-500/[0.02]" : "text-transparent focus:text-white"
                    )}
                    placeholder={!isOverridden ? "Click to override global settings..." : ""}
                />
            </div>
        </div>
    )
}

function PhaseCard({ title, subtitle, color, borderColor, value, globalValue, onChange }: any) {
    const isOverridden = value !== undefined && value !== null && value !== ''

    return (
        <div className={cn(
            "glass rounded-xl p-4 transition-all duration-300 relative",
            isOverridden ? `border-opacity-50 ${borderColor} bg-white/[0.02]` : "border-white/5 opacity-80 hover:opacity-100"
        )}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className={cn("text-[10px] font-bold uppercase tracking-widest", color)}>{title}</h4>
                    <p className="text-[10px] text-white/30">{subtitle}</p>
                </div>
                {isOverridden && <div className={cn("w-1.5 h-1.5 rounded-full shadow-glow animate-pulse", color.replace('text', 'bg'))} />}
            </div>
            <Textarea
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className={cn(
                    "w-full bg-transparent border-0 p-0 text-xs font-mono resize-none h-32 focus-visible:ring-0",
                    isOverridden ? "text-white/90" : "text-white/30"
                )}
                placeholder={globalValue}
            />
        </div>
    )
}
