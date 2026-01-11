'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Brain, Shield, Server, Trash, Settings2, Check, X, User } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        waha_endpoint: '',
        waha_session: 'default',
        waha_api_key: '',
        venice_api_key: '',
        venice_model: 'venice-uncensored',
        anthropic_api_key: '',
        anthropic_model: 'claude-3-haiku-20240307',
        openrouter_api_key: '',
        openrouter_model: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
        ai_provider: 'venice',
        groq_api_key: '',
        mem0_api_key: '',
        // System Messages
        msg_view_once_refusal: '',
        msg_voice_refusal: '',
        msg_media_request_source: '',
        // AI Instructions & Rules
        prompt_identity_template: '',
        prompt_context_template: '',
        prompt_mission_template: '',
        prompt_global_rules: '',
        prompt_social_media_rules: '',
        prompt_image_handling_rules: '',
        prompt_payment_rules: '',
        prompt_voice_note_policy: '',
        prompt_style_instructions: '',
        // Workflow Prompts
        prompt_ai_retry_logic: '',
        prompt_voice_context_check: '',
        prompt_profiler_extraction: '',
        prompt_activator_context: '',
        prompt_media_analysis: '',
        prompt_media_scheduling: '',
        prompt_trust_analysis: '',
        // Log Forwarding
        log_forwarding_enabled: 'false'
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('infrastructure')

    const fetchSettings = useCallback(() => {
        axios.get('/api/settings').then(res => {
            setSettings((prev: any) => ({ ...prev, ...res.data }))
            setLoading(false)
        }).catch(e => console.error(e))
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.put('/api/settings', settings)
        } catch (error) {
            console.error('Error saving settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-6 w-6 text-white/40" />
        </div>
    )

    const tabs = [
        { id: 'infrastructure', label: 'Infrastructure', icon: Server },
        { id: 'intelligence', label: 'Intelligence', icon: Brain },
        { id: 'prompts', label: 'Prompts', icon: Settings2 },
        { id: 'moderation', label: 'Moderation', icon: Shield },
        { id: 'voices', label: 'Voices', icon: Brain },
    ]

    return (
        <div className="space-y-8 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-white">Settings</h1>
                <p className="text-white/40 text-sm mt-1">
                    Configure system-wide settings
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-white/[0.06] pb-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/40 hover:text-white hover:bg-white/[0.04]'
                                }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Infrastructure Tab */}
                {activeTab === 'infrastructure' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">WAHA Server (Baileys)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Endpoint URL
                                    </label>
                                    <Input
                                        value={settings.waha_endpoint}
                                        onChange={(e) => setSettings({ ...settings, waha_endpoint: e.target.value })}
                                        placeholder="http://localhost:3005"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        API Key
                                    </label>
                                    <Input
                                        type="password"
                                        value={settings.waha_api_key}
                                        onChange={(e) => setSettings({ ...settings, waha_api_key: e.target.value })}
                                        placeholder="••••••••"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Default Session
                                    </label>
                                    <Input
                                        value={settings.waha_session}
                                        onChange={(e) => setSettings({ ...settings, waha_session: e.target.value })}
                                        placeholder="default"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RVC / RunPod Serverless */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Voice Synthesis (RVC / RunPod)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        RVC / RunPod URL
                                    </label>
                                    <Input
                                        value={settings.rvc_api_url || ''}
                                        onChange={(e) => setSettings({ ...settings, rvc_api_url: e.target.value })}
                                        placeholder="https://api.runpod.ai/v2/..."
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        RunPod API Key
                                    </label>
                                    <Input
                                        type="password"
                                        value={settings.runpod_api_key || ''}
                                        onChange={(e) => setSettings({ ...settings, runpod_api_key: e.target.value })}
                                        placeholder="rpa_..."
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Native Pitch (f0)
                                    </label>
                                    <Input
                                        value={settings.rvc_f0_up_key || '0'}
                                        onChange={(e) => setSettings({ ...settings, rvc_f0_up_key: e.target.value })}
                                        placeholder="0"
                                        type="number"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                    <p className="text-white/30 text-xs">Default pitch shift logic</p>
                                </div>
                            </div>
                        </div>

                        {/* Log Forwarding */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Log Forwarding (Centralized Logs)</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                    <div>
                                        <p className="text-white font-medium">Enable Log Forwarding</p>
                                        <p className="text-white/40 text-xs mt-1">
                                            Forward all Amplify logs to Baileys server for centralized logging
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({
                                            ...settings,
                                            log_forwarding_enabled: settings.log_forwarding_enabled === 'true' ? 'false' : 'true'
                                        })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.log_forwarding_enabled === 'true' ? 'bg-green-500' : 'bg-white/20'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.log_forwarding_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                {settings.log_forwarding_enabled === 'true' && (
                                    <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                                        <p className="text-green-400 text-sm flex items-center gap-2">
                                            <Check className="h-4 w-4" />
                                            Log forwarding is active. All logs will be sent to: <span className="font-mono">{settings.waha_endpoint}/api/logs/ingest</span>
                                        </p>
                                        <p className="text-white/40 text-xs mt-2">
                                            Logs are forwarded with trace IDs for correlation. Check your Baileys server logs to see the complete message flow.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Intelligence Tab */}
                {activeTab === 'intelligence' && (
                    <div className="space-y-6">
                        {/* AI Provider Selection */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">AI Provider</h3>
                            <div className="grid grid-cols-4 gap-3 mb-6">
                                {['venice', 'anthropic', 'openrouter', 'groq'].map((provider) => (
                                    <button
                                        key={provider}
                                        type="button"
                                        onClick={() => setSettings({ ...settings, ai_provider: provider })}
                                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${settings.ai_provider === provider
                                            ? 'bg-white text-black border-white'
                                            : 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:bg-white/[0.08]'
                                            }`}
                                    >
                                        {provider === 'venice' ? 'Venice AI' :
                                            provider === 'anthropic' ? 'Anthropic' :
                                                provider === 'groq' ? 'Groq' : 'OpenRouter'}
                                    </button>
                                ))}
                            </div>

                            {/* Provider-specific settings */}
                            <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                {settings.ai_provider === 'venice' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Venice API Key
                                            </label>
                                            <Input
                                                type="password"
                                                value={settings.venice_api_key}
                                                onChange={(e) => setSettings({ ...settings, venice_api_key: e.target.value })}
                                                placeholder="••••••••"
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Model
                                            </label>
                                            <Input
                                                value={settings.venice_model}
                                                onChange={(e) => setSettings({ ...settings, venice_model: e.target.value })}
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                    </>
                                )}
                                {settings.ai_provider === 'anthropic' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Anthropic API Key
                                            </label>
                                            <Input
                                                type="password"
                                                value={settings.anthropic_api_key}
                                                onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                                                placeholder="••••••••"
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Model
                                            </label>
                                            <Input
                                                value={settings.anthropic_model}
                                                onChange={(e) => setSettings({ ...settings, anthropic_model: e.target.value })}
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                    </>
                                )}
                                {settings.ai_provider === 'openrouter' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                OpenRouter API Key
                                            </label>
                                            <Input
                                                type="password"
                                                value={settings.openrouter_api_key}
                                                onChange={(e) => setSettings({ ...settings, openrouter_api_key: e.target.value })}
                                                placeholder="••••••••"
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Model
                                            </label>
                                            <Input
                                                value={settings.openrouter_model}
                                                onChange={(e) => setSettings({ ...settings, openrouter_model: e.target.value })}
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Transcription Settings */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Transcription (STT)</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Groq API Key (Whisper)
                                    </label>
                                    <Input
                                        type="password"
                                        value={settings.groq_api_key || ''}
                                        onChange={(e) => setSettings({ ...settings, groq_api_key: e.target.value })}
                                        placeholder="gsk_..."
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                    <p className="text-white/30 text-xs">Required for Voice Note transcription (uses Whisper-large-v3)</p>
                                </div>
                            </div>
                        </div>

                        {/* Long-term Memory */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Long-Term Memory (Mem0)</h3>
                            <div className="space-y-2">
                                <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                    Mem0 API Key
                                </label>
                                <Input
                                    type="password"
                                    value={settings.mem0_api_key || ''}
                                    onChange={(e) => setSettings({ ...settings, mem0_api_key: e.target.value })}
                                    placeholder="m0-..."
                                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                />
                                <p className="text-white/30 text-xs">Required for persistent memory across conversations</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Prompts Tab */}
                {activeTab === 'prompts' && (
                    <div className="space-y-6">
                        {/* System Messages */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Standard Messages (Refusals)</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">View Once Refusal</label>
                                    <Textarea
                                        value={settings.msg_view_once_refusal || ''}
                                        onChange={(e) => setSettings({ ...settings, msg_view_once_refusal: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[80px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Voice Message Refusal</label>
                                    <Textarea
                                        value={settings.msg_voice_refusal || ''}
                                        onChange={(e) => setSettings({ ...settings, msg_voice_refusal: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[80px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Media Request Source Template</label>
                                    <Textarea
                                        value={settings.msg_media_request_source || ''}
                                        onChange={(e) => setSettings({ ...settings, msg_media_request_source: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[80px]"
                                    />
                                    <p className="text-white/30 text-[10px]">Placeholders: {'{PHONE}'}, {'{TYPE}'}</p>
                                </div>
                            </div>
                        </div>

                        {/* AI Instructions (Director Block) */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">AI Core Instructions (Director Blocks)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Identity Template</label>
                                    <Textarea
                                        value={settings.prompt_identity_template || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_identity_template: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Context Template</label>
                                    <Textarea
                                        value={settings.prompt_context_template || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_context_template: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Mission Template</label>
                                    <Textarea
                                        value={settings.prompt_mission_template || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_mission_template: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Global Rules</label>
                                    <Textarea
                                        value={settings.prompt_global_rules || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_global_rules: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Social Media Rules</label>
                                    <Textarea
                                        value={settings.prompt_social_media_rules || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_social_media_rules: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[120px]"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Image Handling Rules</label>
                                    <Textarea
                                        value={settings.prompt_image_handling_rules || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_image_handling_rules: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[150px]"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Payment Rules</label>
                                    <Textarea
                                        value={settings.prompt_payment_rules || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_payment_rules: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[120px]"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Voice Note Policy</label>
                                    <Textarea
                                        value={settings.prompt_voice_note_policy || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_voice_note_policy: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[150px]"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Style & Flow Instructions</label>
                                    <Textarea
                                        value={settings.prompt_style_instructions || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_style_instructions: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[150px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Workflow Prompts */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Background Workflow Prompts (Advanced)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">AI Retry Logic (Empty Resp)</label>
                                    <Textarea
                                        value={settings.prompt_ai_retry_logic || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_ai_retry_logic: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Voice Context Safety Check</label>
                                    <Textarea
                                        value={settings.prompt_voice_context_check || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_voice_context_check: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Profiler Extraction (JSON)</label>
                                    <Textarea
                                        value={settings.prompt_profiler_extraction || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_profiler_extraction: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[120px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Activator Context Instruction</label>
                                    <Textarea
                                        value={settings.prompt_activator_context || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_activator_context: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[120px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Media Safety & Intent Analysis</label>
                                    <Textarea
                                        value={settings.prompt_media_analysis || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_media_analysis: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[120px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Media Delivery Scheduling</label>
                                    <Textarea
                                        value={settings.prompt_media_scheduling || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_media_scheduling: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[120px]"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Trust Score Evolution Analysis</label>
                                    <Textarea
                                        value={settings.prompt_trust_analysis || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_trust_analysis: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[120px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Moderation Tab */}
                {activeTab === 'moderation' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Content Blacklist</h3>
                            <BlacklistManager />
                        </div>
                    </div>
                )}

                {/* Voices Tab */}
                {activeTab === 'voices' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-white font-medium">Voice Library (RVC)</h3>
                                <div className="text-xs text-white/40">Manage global voice models available to agents</div>
                            </div>
                            <VoiceManager />
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/[0.06] z-50">
                    <div className="max-w-4xl mx-auto md:pl-64">
                        {/* Save only applies to global settings, Voices/Blacklist are auto-saved via API calls in components */}
                        <Button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-white text-black hover:bg-white/90"
                        >
                            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Settings'}
                        </Button>
                    </div>
                </div>
            </form >
        </div >
    )
}

function BlacklistManager() {
    const [rules, setRules] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')

    const fetchRules = useCallback(() => {
        axios.get('/api/blacklist').then(res => {
            setRules(res.data)
        }).catch(() => { })
    }, [])

    useEffect(() => {
        fetchRules()
    }, [fetchRules])

    const addRule = async (type: 'image' | 'video') => {
        if (!newItem.trim()) return
        await axios.post('/api/blacklist', { term: newItem, mediaType: type })
        setNewItem('')
        fetchRules()
    }

    const deleteRule = async (id: number) => {
        await axios.delete(`/api/blacklist/${id}`)
        fetchRules()
    }

    const photoRules = rules.filter(r => r.mediaType === 'image' || r.mediaType === 'all')
    const videoRules = rules.filter(r => r.mediaType === 'video' || r.mediaType === 'all')

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Forbidden term (e.g. nudity, face)"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                />
                <Button
                    type="button"
                    onClick={() => addRule('image')}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                >
                    + Photo
                </Button>
                <Button
                    type="button"
                    onClick={() => addRule('video')}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                >
                    + Video
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <h4 className="font-medium text-red-400 mb-3 text-sm">Blocked for Photos</h4>
                    <ul className="space-y-2">
                        {photoRules.length === 0 && (
                            <p className="text-white/30 text-sm">No rules</p>
                        )}
                        {photoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white/[0.04] p-2 rounded-lg">
                                <span className="text-white/80">{rule.term}</span>
                                <button
                                    type="button"
                                    onClick={() => deleteRule(rule.id)}
                                    className="text-red-400 hover:text-red-300 text-lg"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <h4 className="font-medium text-red-400 mb-3 text-sm">Blocked for Videos</h4>
                    <ul className="space-y-2">
                        {videoRules.length === 0 && (
                            <p className="text-white/30 text-sm">No rules</p>
                        )}
                        {videoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white/[0.04] p-2 rounded-lg">
                                <span className="text-white/80">{rule.term}</span>
                                <button
                                    type="button"
                                    onClick={() => deleteRule(rule.id)}
                                    className="text-red-400 hover:text-red-300 text-lg"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}

function VoiceManager() {
    const [voices, setVoices] = useState<any[]>([])
    const [newName, setNewName] = useState('')
    const [newUrl, setNewUrl] = useState('')
    const [newGender, setNewGender] = useState('FEMALE')
    const [newIndexRate, setNewIndexRate] = useState('0.75')
    const [newProtect, setNewProtect] = useState('0.33')
    const [newRmsMixRate, setNewRmsMixRate] = useState('0.25')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<any>(null)

    const fetchVoices = useCallback(() => {
        axios.get('/api/voices').then(res => setVoices(res.data)).catch(() => { })
    }, [])

    useEffect(() => { fetchVoices() }, [fetchVoices])

    const handleAdd = async () => {
        if (!newName || !newUrl) return
        setLoading(true)
        try {
            await axios.post('/api/voices', {
                name: newName,
                url: newUrl,
                gender: newGender,
                indexRate: parseFloat(newIndexRate),
                protect: parseFloat(newProtect),
                rmsMixRate: parseFloat(newRmsMixRate)
            })
            setNewName('')
            setNewUrl('')
            setNewIndexRate('0.75')
            setNewProtect('0.33')
            setNewRmsMixRate('0.25')
            fetchVoices()
        } finally {
            setLoading(false)
        }
    }

    const handleUpdate = async () => {
        if (!editForm) return
        setLoading(true)
        try {
            await axios.patch(`/api/voices/${editForm.id}`, {
                name: editForm.name,
                url: editForm.url,
                gender: editForm.gender,
                indexRate: parseFloat(editForm.indexRate),
                protect: parseFloat(editForm.protect),
                rmsMixRate: parseFloat(editForm.rmsMixRate)
            })
            setEditingId(null)
            setEditForm(null)
            fetchVoices()
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Start deletion?')) return
        await axios.delete(`/api/voices/${id}`)
        fetchVoices()
    }

    return (
        <div className="space-y-4">
            <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Model Name</label>
                        <Input
                            placeholder="e.g. Homer"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Gender</label>
                        <Select value={newGender} onValueChange={setNewGender}>
                            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                                <SelectValue placeholder="Gender" />
                            </SelectTrigger>
                            <SelectContent className="glass-strong border-white/10 text-white">
                                <SelectItem value="MALE">Male (Homme)</SelectItem>
                                <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-medium">HuggingFace Zip URL</label>
                    <Input
                        placeholder="https://huggingface.co/..."
                        value={newUrl}
                        onChange={e => setNewUrl(e.target.value)}
                        className="bg-white/[0.04] border-white/[0.08] text-white"
                    />
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Index Rate</label>
                        <Input
                            type="number"
                            step="0.05"
                            value={newIndexRate}
                            onChange={e => setNewIndexRate(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Protect</label>
                        <Input
                            type="number"
                            step="0.05"
                            value={newProtect}
                            onChange={e => setNewProtect(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">RMS Mix</label>
                        <Input
                            type="number"
                            step="0.05"
                            value={newRmsMixRate}
                            onChange={e => setNewRmsMixRate(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                </div>

                <Button type="button" onClick={handleAdd} disabled={loading} className="w-full bg-white text-black hover:bg-white/90">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Voice to Library'}
                </Button>
            </div>

            <div className="space-y-2">
                {voices.map(voice => (
                    <div key={voice.id} className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] transition-all">
                        {editingId === voice.id ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        placeholder="Name"
                                    />
                                    <Select value={editForm.gender} onValueChange={(val) => setEditForm({ ...editForm, gender: val })}>
                                        <SelectTrigger className="h-8 bg-white/[0.04] border-white/[0.08] text-white text-[10px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="glass-strong border-white/10 text-white">
                                            <SelectItem value="MALE">Male</SelectItem>
                                            <SelectItem value="FEMALE">Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Input
                                    value={editForm.url}
                                    onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                                    className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                    placeholder="URL"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/40 uppercase">Index</label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editForm.indexRate}
                                            onChange={e => setEditForm({ ...editForm, indexRate: e.target.value })}
                                            className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/40 uppercase">Protect</label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editForm.protect}
                                            onChange={e => setEditForm({ ...editForm, protect: e.target.value })}
                                            className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/40 uppercase">RMS Mix</label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editForm.rmsMixRate}
                                            onChange={e => setEditForm({ ...editForm, rmsMixRate: e.target.value })}
                                            className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => { setEditingId(null); setEditForm(null); }}
                                        className="h-8 text-[10px] text-white/40 hover:text-white"
                                    >
                                        <X className="h-3 w-3 mr-1" /> Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleUpdate}
                                        className="h-8 text-[10px] bg-white text-black hover:bg-white/90"
                                    >
                                        <Check className="h-3 w-3 mr-1" /> Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">{voice.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${voice.gender === 'MALE' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-pink-500/10 border-pink-500/20 text-pink-400'}`}>
                                            {voice.gender || 'FEMALE'}
                                        </span>
                                        <div className="flex gap-2 ml-2">
                                            <span className="text-[10px] text-white/30">Index: {Number(voice.indexRate).toFixed(2)}</span>
                                            <span className="text-[10px] text-white/30">Prot: {Number(voice.protect).toFixed(2)}</span>
                                            <span className="text-[10px] text-white/30">RMS: {Number(voice.rmsMixRate).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-white/40 truncate max-w-md">{voice.url}</div>
                                </div>

                                <div className="flex gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-white/40 hover:text-white"
                                        onClick={() => {
                                            setEditingId(voice.id);
                                            setEditForm({ ...voice });
                                        }}
                                    >
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-400/60 hover:text-red-400"
                                        onClick={() => handleDelete(voice.id)}
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {voices.length === 0 && <div className="text-white/30 text-center py-4 text-sm">No voices found</div>}
            </div>

            <div className="mt-8 pt-8 border-t border-white/[0.06]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium">Voice Playground</h3>
                    <div className="text-xs text-white/40">Test and preview voice models</div>
                </div>
                <VoiceTester voices={voices} />
            </div>
        </div >
    )
}

function VoiceTester({ voices }: { voices: any[] }) {
    const [selectedVoice, setSelectedVoice] = useState('')
    const [sourceGender, setSourceGender] = useState('MALE')
    const [recording, setRecording] = useState(false)
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
    const [resultAudio, setResultAudio] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const recorder = new MediaRecorder(stream)
            const chunks: BlobPart[] = []

            recorder.ondataavailable = (e) => chunks.push(e.data)
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' })
                setAudioBlob(blob)
                setResultAudio(null)
            }

            recorder.start()
            setMediaRecorder(recorder)
            setRecording(true)
        } catch (e) {
            alert('Microphone access denied')
        }
    }

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop()
            setRecording(false)
            mediaRecorder.stream.getTracks().forEach(t => t.stop()) // Stop stream
        }
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setAudioBlob(e.target.files[0])
            setResultAudio(null)
        }
    }

    const [history, setHistory] = useState<any[]>([])

    const fetchHistory = useCallback(() => {
        axios.get('/api/voices/generations').then(res => setHistory(res.data)).catch(() => { })
    }, [])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    const deleteGeneration = async (id: number) => {
        await axios.delete(`/api/voices/generations/${id}`)
        fetchHistory()
    }

    const [statusMessage, setStatusMessage] = useState('')

    const checkStatus = async (generationId: number) => {
        try {
            const res = await axios.get(`/api/voices/generations/${generationId}`)
            if (res.data.status === 'COMPLETED') {
                setResultAudio(res.data.audioUrl)
                setProcessing(false)
                setStatusMessage('')
                fetchHistory()
            } else if (res.data.status === 'FAILED') {
                setProcessing(false)
                setStatusMessage('Conversion Failed')
                alert('Conversion Failed')
            } else {
                // Still pending
                setStatusMessage(`Processing... (${res.data.status})`)
                setTimeout(() => checkStatus(generationId), 3000)
            }
        } catch (e) {
            setProcessing(false)
            alert('Error checking status')
        }
    }

    const processAudio = async () => {
        if (!audioBlob || !selectedVoice) return
        setProcessing(true)
        setResultAudio(null)
        setStatusMessage('Reading Audio...')

        try {
            const reader = new FileReader()
            reader.readAsDataURL(audioBlob)
            reader.onloadend = async () => {
                const base64 = reader.result as string
                // Split base64 content only (remove data:audio... prefix for calculation, but keeping it for reassembly might be safer server side? 
                // Our API expects partial chunks. Let's send raw base64 string including header, server reassembles string.

                const CHUNK_SIZE = 1024 * 1024 // 1MB chunks
                const totalLength = base64.length
                const totalChunks = Math.ceil(totalLength / CHUNK_SIZE)
                // Generate a random Upload ID
                const uploadId = Math.random().toString(36).substring(7) + Date.now().toString()

                setStatusMessage(`Uploading Chunk 1/${totalChunks}...`)

                let finalResponse = null;

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE
                    const end = Math.min(start + CHUNK_SIZE, totalLength)
                    const chunk = base64.substring(start, end)

                    setStatusMessage(`Uploading Chunk ${i + 1}/${totalChunks}...`)

                    const res = await axios.post('/api/voices/upload', {
                        uploadId,
                        index: i,
                        total: totalChunks,
                        chunk,
                        voiceId: selectedVoice,
                        sourceGender
                    })

                    if (res.data.generationId) {
                        finalResponse = res.data
                    }
                }

                if (finalResponse?.generationId) {
                    setStatusMessage('Job Started. Waiting for GPU...')
                    setTimeout(() => checkStatus(finalResponse.generationId), 2000)
                } else {
                    throw new Error("Upload completed but no Job ID returned.")
                }
            }
        } catch (e: any) {
            console.error(e)
            const msg = e.response?.data?.error || 'Conversion or Upload failed'
            alert(msg)
            setProcessing(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-white/40 mb-1 block">Voice Model (Target)</label>
                        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                            <SelectTrigger className="w-full h-10 bg-white/[0.04] border-white/[0.08] text-white">
                                <SelectValue placeholder="Select a Voice Model..." />
                            </SelectTrigger>
                            <SelectContent>
                                {voices.map(v => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        {v.name} ({v.gender || 'FEMALE'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-blue-200">
                            <strong>Custom RVC Settings:</strong> Pitch is auto-calculated, but Index/Protect/RMS are now pulled from the voice model settings.
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">I am:</span>
                            <Select value={sourceGender} onValueChange={setSourceGender}>
                                <SelectTrigger className="h-8 bg-black/20 text-white text-xs border-white/10 w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="glass-strong border-white/10 text-white">
                                    <SelectItem value="MALE">Male (Homme)</SelectItem>
                                    <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-black/20 border border-white/[0.04] flex flex-col items-center justify-center gap-2 h-32">
                        <div className="text-xs font-medium text-white/40 uppercase">Input Source</div>
                        {recording ? (
                            <Button type="button" variant="destructive" onClick={stopRecording} className="animate-pulse">
                                Stop Recording
                            </Button>
                        ) : (
                            <div className="flex flex-col items-center gap-2 w-full">
                                <Button type="button" variant="secondary" onClick={startRecording} className="w-full bg-white/10 hover:bg-white/20 text-white border-0">
                                    🎤 Record
                                </Button>
                                <span className="text-xs text-white/20">- OR -</span>
                                <Input type="file" accept="audio/*" onChange={handleFile} className="bg-transparent border-0 text-white/60 text-xs file:bg-white/10 file:text-white file:border-0 file:rounded-md" />
                            </div>
                        )}
                        {audioBlob && !recording && <span className="text-xs text-green-400">Audio Ready ({Math.round(audioBlob.size / 1024)} KB)</span>}
                    </div>

                    <div className="p-4 rounded-lg bg-black/20 border border-white/[0.04] flex flex-col items-center justify-center gap-2 h-32 relative">
                        <div className="text-xs font-medium text-white/40 uppercase">Output</div>
                        {processing ? (
                            <div className="flex flex-col items-center gap-2 text-white/50">
                                <Loader2 className="animate-spin h-6 w-6" />
                                <span className="text-xs">Processing... (this may take 10-20s)</span>
                            </div>
                        ) : resultAudio ? (
                            <div className="w-full flex flex-col items-center gap-2">
                                <audio controls src={resultAudio} className="w-full h-8" />
                                <a href={resultAudio} download="test_voice.mp3" className="text-xs text-blue-400 hover:underline">Download</a>
                            </div>
                        ) : (
                            <span className="text-xs text-white/20">Ready to convert</span>
                        )}

                        <Button
                            onClick={processAudio}
                            disabled={!audioBlob || !selectedVoice || processing}
                            className="w-full h-12 text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {statusMessage || 'Processing (may take ~60s for cold start)...'}
                                </>
                            ) : (
                                'Generate Voice (RVC)'
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="space-y-3">
                <h4 className="text-white font-medium text-sm">Past Generations (Polling Enabled)</h4>
                <div className="space-y-2">
                    {history.map(gen => (
                        <div key={gen.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="text-xs text-white/40">
                                    {new Date(gen.createdAt).toLocaleTimeString()}
                                </div>
                                <div className="text-sm font-medium text-white">
                                    {gen.voiceModel?.name || 'Unknown Voice'}
                                    {gen.status && gen.status !== 'COMPLETED' && (
                                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${gen.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                                            gen.status === 'FAILED' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                            {gen.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {gen.status === 'COMPLETED' ? (
                                    <audio controls src={`/api/voices/generations/${gen.id}/audio`} className="h-6 w-32" />
                                ) : (
                                    <span className="text-xs text-white/20">Processing...</span>
                                )}

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 w-6 p-0"
                                    onClick={() => deleteGeneration(gen.id)}
                                >
                                    <Trash className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <div className="text-white/20 text-xs text-center py-4">No history yet</div>
                    )}
                </div>
            </div>
        </div>
    )
}
