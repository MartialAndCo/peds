'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Brain, Server, Check } from 'lucide-react'
import { SessionManager } from '@/components/settings/session-manager'

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
        // AI Parameters
        ai_temperature: '0.7',
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
    ]

    return (
        <div className="space-y-8 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-white">System Settings</h1>
                <p className="text-white/40 text-sm mt-1">
                    Configure global infrastructure and AI providers
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

                        {/* Session Management */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Session Management</h3>
                            <SessionManager settings={settings} />
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
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {['venice', 'groq'].map((provider) => (
                                    <button
                                        key={provider}
                                        type="button"
                                        onClick={() => setSettings({ ...settings, ai_provider: provider })}
                                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${settings.ai_provider === provider
                                            ? 'bg-white text-black border-white'
                                            : 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:bg-white/[0.08]'
                                            }`}
                                    >
                                        {provider === 'venice' ? 'Venice AI' : 'Groq'}
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
                            </div>
                        </div>

                        {/* AI Parameters */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">AI Parameters</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Temperature ({settings.ai_temperature || '0.7'})
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={settings.ai_temperature || '0.7'}
                                        onChange={(e) => setSettings({ ...settings, ai_temperature: e.target.value })}
                                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                                    />
                                    <div className="flex justify-between text-white/30 text-xs">
                                        <span>0.0 (Precise)</span>
                                        <span>1.0 (Creative)</span>
                                    </div>
                                    <p className="text-white/30 text-xs">Higher values produce more creative but less consistent responses</p>
                                </div>
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

                {/* Save Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/[0.06] z-50">
                    <div className="max-w-4xl mx-auto md:pl-64">
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
