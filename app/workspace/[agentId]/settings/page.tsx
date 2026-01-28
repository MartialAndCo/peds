'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, Trash, Mic2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type Agent = {
    id: string
    name: string
    voiceModelId: number | null
    operatorGender: string
}

export default function AgentSettingsPage() {
    const { agentId } = useParams()
    const router = useRouter()
    const [agent, setAgent] = useState<Agent | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Voice State
    const [voices, setVoices] = useState<any[]>([])
    const [voiceState, setVoiceState] = useState({ modelId: 'default', gender: 'MALE' })
    const [promptSettings, setPromptSettings] = useState<Record<string, string>>({})
    const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({})

    // Init Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [agentRes, promptsRes, voicesRes] = await Promise.all([
                    axios.get('/api/agents'),
                    axios.get(`/api/agents/${agentId}/settings`),
                    axios.get('/api/voices')
                ])

                const agentsData = Array.isArray(agentRes.data) ? agentRes.data : []
                const found = agentsData.find((a: any) => a.id.toString() === agentId)
                if (found) {
                    setAgent(found)
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tighter text-white italic">Technical Settings</h2>
                    <p className="text-white/40 text-sm mt-1">Configure audio pipeline and system behavior.</p>
                </div>

                <Button
                    onClick={handleSaveAll}
                    disabled={saving}
                    className="bg-white text-black hover:bg-white/90 font-bold uppercase tracking-widest text-[11px]"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Config
                </Button>
            </div>

            <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Mic2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">Voice Configuration</h3>
                        <p className="text-white/40 text-xs">Configure voice models and behavior for this agent.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Voice Selection */}
                    <div className="space-y-4 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
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
                            <p className="text-[10px] text-white/30">Matches the gender of the human operator (you)</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-white/50 tracking-wider">Voice Model</Label>
                            <Select value={voiceState.modelId} onValueChange={(v) => setVoiceState({ ...voiceState, modelId: v })}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default" className="text-muted-foreground">-- No Voice (Text Only) --</SelectItem>
                                    {voices.map(v => (
                                        <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-xs uppercase text-white/50 tracking-wider">Voice Response Mode</Label>
                                    <p className="text-[10px] text-white/30 mt-1">Reply to voice notes with voice notes</p>
                                </div>
                                <Switch
                                    checked={promptSettings['voice_response_enabled'] === 'true'}
                                    onCheckedChange={(checked) => setPromptSettings({ ...promptSettings, voice_response_enabled: checked ? 'true' : 'false' })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Voice Policy */}
                    <div className="md:col-span-2 space-y-2">
                        <Label className="text-xs uppercase text-white/50 tracking-wider">Voice Note Policy</Label>
                        <PromptCard
                            value={promptSettings['prompt_voice_note_policy']}
                            globalValue={globalSettings['prompt_voice_note_policy']}
                            onChange={(v: string) => setPromptSettings({ ...promptSettings, prompt_voice_note_policy: v })}
                            minHeight="min-h-[220px]"
                        />
                    </div>
                </div>
            </div>

            {/* Phase Progression Configuration */}
            <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <Save className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">Auto-Progression Rules</h3>
                        <p className="text-white/40 text-xs">Configure how contacts move between phases.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SettingInput
                        label="Trust Threshold: Phase 2"
                        desc="Score needed for Fast Track to Phase 2"
                        value={promptSettings['phase_limit_trust_medium']}
                        globalValue={globalSettings['phase_limit_trust_medium'] || '60'}
                        onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_limit_trust_medium: v })}
                    />
                    <SettingInput
                        label="Trust Threshold: Phase 3"
                        desc="Score needed for Fast Track to Phase 3"
                        value={promptSettings['phase_limit_trust_high']}
                        globalValue={globalSettings['phase_limit_trust_high'] || '75'}
                        onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_limit_trust_high: v })}
                    />
                    <div className="hidden lg:block"></div>

                    <SettingInput
                        label="Phase 1 duration (Fast)"
                        desc="Minimum days if Trust is High"
                        value={promptSettings['phase_days_fast_connection']}
                        globalValue={globalSettings['phase_days_fast_connection'] || '2'}
                        onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_days_fast_connection: v })}
                    />
                    <SettingInput
                        label="Phase 1 duration (Slow)"
                        desc="Force move to Phase 2 after N days"
                        value={promptSettings['phase_days_slow_connection']}
                        globalValue={globalSettings['phase_days_slow_connection'] || '5'}
                        onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_days_slow_connection: v })}
                    />
                    <SettingInput
                        label="Phase 2 duration (Slow)"
                        desc="Force move to Phase 3 after N days"
                        value={promptSettings['phase_days_slow_vulnerability']}
                        globalValue={globalSettings['phase_days_slow_vulnerability'] || '12'}
                        onChange={(v: string) => setPromptSettings({ ...promptSettings, phase_days_slow_vulnerability: v })}
                    />
                </div>
            </div>



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
        </div >
    )
}

function PromptCard({ value, globalValue, onChange, minHeight = "min-h-[120px]" }: any) {
    const isOverridden = value !== undefined && value !== null && value !== ''

    return (
        <div className={cn(
            "glass rounded-xl p-0 overflow-hidden group transition-all duration-300",
            isOverridden ? "border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "border-white/5"
        )}>
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
                        "w-full bg-transparent border-0 rounded-none focus-visible:ring-0 p-4 text-xs font-mono leading-relaxed resize-y",
                        minHeight,
                        isOverridden ? "text-white bg-blue-500/[0.02]" : "text-transparent focus:text-white"
                    )}
                    placeholder={!isOverridden ? "Click to override..." : ""}
                />
            </div>
            {isOverridden && (
                <div className="absolute top-2 right-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400 text-white/20 bg-black/20"
                        onClick={() => onChange('')}
                        title="Reset to Global"
                    >
                        <Trash className="w-3 h-3" />
                    </Button>
                </div>
            )}
        </div>
    )
}

function SettingInput({ label, desc, value, globalValue, onChange }: any) {
    const isOverridden = value !== undefined && value !== null && value !== ''

    return (
        <div className={cn(
            "rounded-xl border p-4 transition-all duration-300 relative group",
            isOverridden ? "bg-purple-500/[0.02] border-purple-500/30" : "bg-white/[0.02] border-white/5"
        )}>
            <Label className="text-xs uppercase text-white/50 tracking-wider block mb-1">{label}</Label>
            <p className="text-[10px] text-white/30 mb-3">{desc}</p>

            <div className="relative">
                <input
                    type="text"
                    value={value || ''}
                    placeholder={globalValue ? `Default: ${globalValue}` : 'No default'}
                    onChange={e => onChange(e.target.value)}
                    className={cn(
                        "w-full bg-transparent border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50",
                        isOverridden ? "border-purple-500/30 text-white" : "border-white/10 text-white/60"
                    )}
                />

                {isOverridden && (
                    <button
                        onClick={() => onChange('')}
                        className="absolute right-2 top-2 text-white/20 hover:text-red-400"
                        title="Reset to Default"
                    >
                        <Trash className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    )
}
