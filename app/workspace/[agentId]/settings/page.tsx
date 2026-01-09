'use client'

import { useState, useEffect, ReactNode } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Trash, Sparkles, User, Mic2, Shield, Fingerprint, Save, Eye, Palette, Layers, AlertOctagon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Types
type Agent = {
    id: number
    name: string
    color: string
    voiceModelId: number | null
    operatorGender: string
}

type TabId = 'general' | 'personality' | 'voice' | 'danger'

export default function AgentSettingsPage() {
    const { agentId } = useParams()
    const router = useRouter()
    const [agent, setAgent] = useState<Agent | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabId>('general')

    // Data States
    const [formData, setFormData] = useState({ name: '', color: '' })
    const [promptSettings, setPromptSettings] = useState<Record<string, string>>({})
    const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({})

    // Voice State
    const [voices, setVoices] = useState<any[]>([])
    const [voiceState, setVoiceState] = useState({ modelId: 'default', gender: 'MALE' })

    const [saving, setSaving] = useState(false)

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
            // 1. Save Core Agent Data (Name, Color, Voice)
            await axios.put(`/api/agents/${agentId}`, {
                ...formData,
                voiceModelId: voiceState.modelId === 'default' ? null : parseInt(voiceState.modelId),
                operatorGender: voiceState.gender
            })

            // 2. Save Prompts
            await axios.put(`/api/agents/${agentId}/settings`, promptSettings)

            // toast.success("Agent saved successfully")
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

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>
    if (!agent) return <div className="text-white">Agent not found</div>

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#0f1115]">
            {/* SIDEBAR NAVIGATION */}
            <div className="w-64 border-r border-white/[0.06] bg-[#0f1115] flex flex-col">
                <div className="p-6 pb-2">
                    <h1 className="text-xl font-semibold text-white tracking-tight">Agent Builder</h1>
                    <p className="text-xs text-white/40 mt-1">Configure {agent.name}</p>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    <NavButton
                        active={activeTab === 'general'}
                        onClick={() => setActiveTab('general')}
                        icon={User}
                        label="General & Identity"
                    />
                    <NavButton
                        active={activeTab === 'personality'}
                        onClick={() => setActiveTab('personality')}
                        icon={Fingerprint}
                        label="Personality Matrix"
                    />
                    <NavButton
                        active={activeTab === 'voice'}
                        onClick={() => setActiveTab('voice')}
                        icon={Mic2}
                        label="Voice Engine"
                    />
                    <NavButton
                        active={activeTab === 'danger'}
                        onClick={() => setActiveTab('danger')}
                        icon={AlertOctagon}
                        label="Danger Zone"
                        variant="danger"
                    />
                </nav>

                <div className="p-4 border-t border-white/[0.06] bg-black/20">
                    <Button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="w-full bg-white text-black hover:bg-white/90 transition-all font-medium"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#0f1115] to-[#1a1d24]">
                <div className="max-w-4xl mx-auto p-8 py-10">

                    {/* --- TAB: GENERAL --- */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <SectionHeader title="Core Identity" description="Basic appearance and fundamental role instruction." />

                            {/* Cosmetic Card */}
                            <div className="glass-panel p-6 rounded-2xl space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-white/50 tracking-wider">Agent Name</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="glass-input h-11 text-lg"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-white/50 tracking-wider">Brand Color</Label>
                                        <div className="flex gap-3">
                                            <div
                                                className="w-11 h-11 rounded-lg border border-white/10 shadow-inner"
                                                style={{ backgroundColor: formData.color }}
                                            />
                                            <Input
                                                value={formData.color}
                                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                                className="glass-input h-11 font-mono uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Identity Prompt */}
                            <div className="glass-panel p-1 rounded-2xl">
                                <PromptEditor
                                    label="Identity Template"
                                    description="Who is this agent? Define name, age, backstory, and core traits."
                                    value={promptSettings['prompt_identity_template']}
                                    globalValue={globalSettings['prompt_identity_template']}
                                    onChange={(v) => setPromptSettings({ ...promptSettings, prompt_identity_template: v })}
                                    minHeight="min-h-[200px]"
                                />
                            </div>

                            <div className="glass-panel p-1 rounded-2xl">
                                <PromptEditor
                                    label="Context Awareness"
                                    description="How the agent perceives the user and current situation."
                                    value={promptSettings['prompt_context_template']}
                                    globalValue={globalSettings['prompt_context_template']}
                                    onChange={(v) => setPromptSettings({ ...promptSettings, prompt_context_template: v })}
                                />
                            </div>
                        </div>
                    )}

                    {/* --- TAB: PERSONALITY (Phases et Rules) --- */}
                    {activeTab === 'personality' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

                            {/* Phases Section */}
                            <div>
                                <SectionHeader title="Relationship Phases" description="How the agent evolves over time." />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                    <PhaseCard
                                        title="Phase A: Connection"
                                        subtitle="Seduction & Discovery"
                                        color="border-blue-500/30 bg-blue-500/5"
                                        value={promptSettings['phase_prompt_connection']}
                                        globalValue={globalSettings['phase_prompt_connection']}
                                        onChange={(v) => setPromptSettings({ ...promptSettings, phase_prompt_connection: v })}
                                    />
                                    <PhaseCard
                                        title="Phase B: Vulnerability"
                                        subtitle="Confidences & Bonding"
                                        color="border-purple-500/30 bg-purple-500/5"
                                        value={promptSettings['phase_prompt_vulnerability']}
                                        globalValue={globalSettings['phase_prompt_vulnerability']}
                                        onChange={(v) => setPromptSettings({ ...promptSettings, phase_prompt_vulnerability: v })}
                                    />
                                    <PhaseCard
                                        title="Phase C: Crisis"
                                        subtitle="Urgency & Help"
                                        color="border-amber-500/30 bg-amber-500/5"
                                        value={promptSettings['phase_prompt_crisis']}
                                        globalValue={globalSettings['phase_prompt_crisis']}
                                        onChange={(v) => setPromptSettings({ ...promptSettings, phase_prompt_crisis: v })}
                                    />
                                    <PhaseCard
                                        title="Phase D: MoneyPot"
                                        subtitle="Retention & Maintenance"
                                        color="border-emerald-500/30 bg-emerald-500/5"
                                        value={promptSettings['phase_prompt_moneypot']}
                                        globalValue={globalSettings['phase_prompt_moneypot']}
                                        onChange={(v) => setPromptSettings({ ...promptSettings, phase_prompt_moneypot: v })}
                                    />
                                </div>
                            </div>

                            {/* Rules & Style Section */}
                            <div>
                                <SectionHeader title="Rules & Style" description="Constraints, tone, and safety guardrails." />
                                <div className="space-y-4 mt-6">
                                    <PromptEditor
                                        label="Global Rules"
                                        value={promptSettings['prompt_global_rules']}
                                        globalValue={globalSettings['prompt_global_rules']}
                                        onChange={(v) => setPromptSettings({ ...promptSettings, prompt_global_rules: v })}
                                    />
                                    <PromptEditor
                                        label="Style & Tone Instructions"
                                        value={promptSettings['prompt_style_instructions']}
                                        globalValue={globalSettings['prompt_style_instructions']}
                                        onChange={(v) => setPromptSettings({ ...promptSettings, prompt_style_instructions: v })}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <PromptEditor
                                            label="Image Handling"
                                            value={promptSettings['prompt_image_handling_rules']}
                                            globalValue={globalSettings['prompt_image_handling_rules']}
                                            onChange={(v) => setPromptSettings({ ...promptSettings, prompt_image_handling_rules: v })}
                                        />
                                        <PromptEditor
                                            label="Payment Handling"
                                            value={promptSettings['prompt_payment_rules']}
                                            globalValue={globalSettings['prompt_payment_rules']}
                                            onChange={(v) => setPromptSettings({ ...promptSettings, prompt_payment_rules: v })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: VOICE --- */}
                    {activeTab === 'voice' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-8">
                            <SectionHeader title="Voice Engine" description="Configure RVC model and operator settings." />
                            <div className="glass-panel p-8 rounded-2xl max-w-2xl">
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-xs uppercase text-white/50 tracking-wider">Operator Gender (Source)</Label>
                                        <Select value={voiceState.gender} onValueChange={(v) => setVoiceState({ ...voiceState, gender: v })}>
                                            <SelectTrigger className="glass-input h-12">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="glass-popover">
                                                <SelectItem value="MALE">Male (Homme)</SelectItem>
                                                <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-white/30">Used for pitch calculation.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs uppercase text-white/50 tracking-wider">Target Voice Model (RVC)</Label>
                                        <Select value={voiceState.modelId} onValueChange={(v) => setVoiceState({ ...voiceState, modelId: v })}>
                                            <SelectTrigger className="glass-input h-12">
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
                                </div>
                            </div>
                            <div className="glass-panel p-1 rounded-2xl">
                                <PromptEditor
                                    label="Voice Note Policy"
                                    description="Rules for when to send voice notes."
                                    value={promptSettings['prompt_voice_note_policy']}
                                    globalValue={globalSettings['prompt_voice_note_policy']}
                                    onChange={(v) => setPromptSettings({ ...promptSettings, prompt_voice_note_policy: v })}
                                />
                            </div>
                        </div>
                    )}

                    {/* --- TAB: DANGER --- */}
                    {activeTab === 'danger' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-8 space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-red-400">Delete Agent</h3>
                                    <p className="text-sm text-red-200/60 mt-1">This action cannot be undone. All conversations will be orphaned.</p>
                                </div>
                                <Button variant="destructive" onClick={handleDelete} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20">
                                    <Trash className="w-4 h-4 mr-2" /> Permanently Delete
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// --- SUBCOMPONENTS ---

function NavButton({ icon: Icon, label, active, onClick, variant = 'default' }: any) {
    const isDanger = variant === 'danger';
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                active
                    ? (isDanger ? "bg-red-500/10 text-red-400" : "bg-white/10 text-white")
                    : (isDanger ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/5" : "text-white/40 hover:text-white hover:bg-white/5")
            )}
        >
            <Icon className={cn("w-4 h-4", active ? "opacity-100" : "opacity-70")} />
            {label}
            {active && !isDanger && <div className="ml-auto w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />}
        </button>
    )
}

function SectionHeader({ title, description }: { title: string, description: string }) {
    return (
        <div className="mb-6">
            <h2 className="text-2xl font-light text-white tracking-wide">{title}</h2>
            <p className="text-white/40 mt-1">{description}</p>
        </div>
    )
}

function PromptEditor({ label, description, value, globalValue, onChange, minHeight = "min-h-[120px]" }: any) {
    const isOverridden = value !== undefined && value !== null && value !== ''

    return (
        <div className="bg-black/20 hover:bg-black/30 transition-colors p-5 rounded-xl group relative border border-white/5 hover:border-white/10">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className={cn("text-sm font-medium tracking-wide", isOverridden ? "text-blue-300" : "text-white/70")}>
                        {label}
                    </h4>
                    {description && <p className="text-[11px] text-white/30 mt-0.5">{description}</p>}
                </div>
                {isOverridden && (
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                            Custom
                        </span>
                        <button
                            onClick={() => onChange('')}
                            className="text-white/20 hover:text-red-400 transition-colors"
                            title="Reset to Global"
                        >
                            <Trash className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            <div className="relative">
                <Textarea
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={globalValue || "(No global default)"}
                    className={cn(
                        "w-full bg-transparent border-0 p-0 text-sm font-light leading-relaxed resize-y focus:ring-0 placeholder:text-white/20",
                        minHeight,
                        !isOverridden && "opacity-60"
                    )}
                />
            </div>
        </div>
    )
}

function PhaseCard({ title, subtitle, color, value, globalValue, onChange }: any) {
    const isOverridden = value !== undefined && value !== null && value !== ''

    return (
        <div className={cn("relative p-5 rounded-xl border transition-all duration-300 group",
            isOverridden ? "border-white/20 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] hover:border-white/10"
        )}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border mb-1.5 inline-block", color)}>
                        {title}
                    </span>
                    <p className="text-xs text-white/50">{subtitle}</p>
                </div>
                {isOverridden && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-glow" />
                )}
            </div>
            <Textarea
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={globalValue}
                className={cn(
                    "w-full bg-transparent border-0 p-0 text-xs font-light resize-none h-24 focus:ring-0 focus:text-white placeholder:text-white/10",
                    !isOverridden && "opacity-50"
                )}
            />
        </div>
    )
}
