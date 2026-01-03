'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

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
        ai_provider: 'venice'
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [wahaStatus, setWahaStatus] = useState<string>('UNKNOWN')
    const [wahaMe, setWahaMe] = useState<any>(null)
    const [activeTab, setActiveTab] = useState('connections')

    const fetchSettings = useCallback(() => {
        axios.get('/api/settings').then(res => {
            setSettings((prev: any) => ({ ...prev, ...res.data }))
            setLoading(false)
        }).catch(e => console.error(e))
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await axios.get('/api/waha/status')
                let status = res.data.status || 'UNREACHABLE'
                if (status === 'SCAN_QR_CODE') status = 'SCAN_QR'
                setWahaStatus(status)
                setWahaMe(res.data.me)
            } catch (e: any) {
                setWahaStatus('UNREACHABLE')
            }
        }
        checkStatus()
        const interval = setInterval(checkStatus, 5000)
        return () => clearInterval(interval)
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.put('/api/settings', settings)
            alert('Settings saved')
        } catch (error) {
            alert('Error saving settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-10 text-center">Loading settings...</div>

    const TabButton = ({ id, label, icon }: any) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${activeTab === id
                ? 'bg-slate-900 text-white font-medium shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
                <p className="text-muted-foreground">Manage your AI agent's brain, connections, and behavior.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Custom Tab Navigation */}
                <div className="flex space-x-1 border-b pb-2 overflow-x-auto">
                    <TabButton id="connections" label="Connections" icon={<span className="text-lg">🔌</span>} />
                    <TabButton id="intelligence" label="Intelligence" icon={<span className="text-lg">🧠</span>} />
                    <TabButton id="persona" label="Persona & Roles" icon={<span className="text-lg">🎭</span>} />
                    <TabButton id="moderation" label="Moderation" icon={<span className="text-lg">🛡️</span>} />
                </div>

                {/* --- TAB: CONNECTIONS --- */}
                {activeTab === 'connections' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* WAHA Status */}
                        <Card className="border-2 border-blue-50 overflow-hidden">
                            <CardHeader className="bg-blue-50/50">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-green-500 text-white rounded-full">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                        </div>
                                        <CardTitle>WhatsApp Status</CardTitle>
                                    </div>
                                    <Badge variant={wahaStatus === 'WORKING' ? 'default' : 'destructive'} className="text-sm px-3 py-1">
                                        {wahaStatus}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6 flex flex-col items-center justify-center min-h-[150px]">
                                {wahaStatus === 'SCAN_QR' && (
                                    <div className="text-center space-y-4">
                                        <p className="font-medium animate-pulse">Scan this QR Code with WhatsApp</p>
                                        <img src="/api/waha/qr" alt="WhatsApp QR Code" className="w-64 h-64 border-4 border-slate-200 rounded-xl shadow-lg" />
                                        <Button type="button" variant="destructive" onClick={async () => {
                                            setWahaStatus('STOPPING'); try { await axios.post('/api/session/stop'); setWahaStatus('STOPPED') } catch (e) { alert('Failed') }
                                        }}>Stop Session</Button>
                                    </div>
                                )}
                                {wahaStatus === 'WORKING' && wahaMe && (
                                    <div className="text-center text-green-700 space-y-2">
                                        <p className="text-2xl font-bold">Connected as {wahaMe.pushName || 'User'}</p>
                                        <p className="opacity-70 font-mono">{wahaMe.id}</p>
                                        <Button type="button" variant="destructive" onClick={async () => {
                                            setWahaStatus('STOPPING'); try { await axios.post('/api/session/stop'); setWahaStatus('STOPPED') } catch (e) { alert('Failed') }
                                        }}>Stop Session</Button>
                                    </div>
                                )}
                                {(wahaStatus === 'UNREACHABLE' || wahaStatus === 'UNKNOWN') && (
                                    <div className="text-center text-red-500">
                                        <p>Cannot connect to WAHA Server.</p>
                                    </div>
                                )}
                                {wahaStatus === 'STOPPED' && (
                                    <div className="text-center">
                                        <Button type="button" onClick={async () => {
                                            setWahaStatus('STARTING'); try { await axios.post('/api/session/start') } catch (e: any) { alert(e.message) }
                                        }}>Start Session</Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle>WAHA Details</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <Label>Endpoint URL</Label>
                                        <Input value={settings.waha_endpoint} onChange={(e) => setSettings({ ...settings, waha_endpoint: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>API Key</Label>
                                        <Input type="password" value={settings.waha_api_key} onChange={(e) => setSettings({ ...settings, waha_api_key: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Session Name</Label>
                                        <Input value={settings.waha_session} onChange={(e) => setSettings({ ...settings, waha_session: e.target.value })} />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Phone Numbers</CardTitle></CardHeader>{/* UI Updated for Media Separation */}
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <Label>Admin Number (Notifications)</Label>
                                        <Input value={settings.source_phone_number || ''} onChange={(e) => setSettings({ ...settings, source_phone_number: e.target.value })} placeholder="+33..." />
                                        <p className="text-xs text-muted-foreground">Admin number for system alerts.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Media Source Number (Content)</Label>
                                        <Input value={settings.media_source_number || ''} onChange={(e) => setSettings({ ...settings, media_source_number: e.target.value })} placeholder="+33..." />
                                        <p className="text-xs text-muted-foreground">Number that receives media requests.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Voice Source Number (Human Audio)</Label>
                                        <Input value={settings.voice_source_number || ''} onChange={(e) => setSettings({ ...settings, voice_source_number: e.target.value })} placeholder="+33..." />
                                        <p className="text-xs text-muted-foreground">Number that receives voice requests to record.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Lead Provider Number (Data Input)</Label>
                                        <Input value={settings.lead_provider_number || ''} onChange={(e) => setSettings({ ...settings, lead_provider_number: e.target.value })} placeholder="+33..." />
                                        <p className="text-xs text-muted-foreground">Number authorized to send new leads (Phone + Context).</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* --- TAB: INTELLIGENCE --- */}
                {activeTab === 'intelligence' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card>
                            <CardHeader><CardTitle>AI Provider</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <Button type="button" variant={settings.ai_provider === 'venice' ? 'default' : 'outline'} onClick={() => setSettings({ ...settings, ai_provider: 'venice' })} className="w-full">Venice AI</Button>
                                    <Button type="button" variant={settings.ai_provider === 'anthropic' ? 'default' : 'outline'} onClick={() => setSettings({ ...settings, ai_provider: 'anthropic' })} className="w-full">Anthropic</Button>
                                    <Button type="button" variant={settings.ai_provider === 'openrouter' ? 'default' : 'outline'} onClick={() => setSettings({ ...settings, ai_provider: 'openrouter' })} className="w-full">OpenRouter</Button>
                                </div>

                                {settings.ai_provider === 'venice' && (
                                    <div className="space-y-4 border rounded p-4 bg-slate-50">
                                        <div className="space-y-1">
                                            <Label>Venice API Key</Label>
                                            <Input type="password" value={settings.venice_api_key} onChange={(e) => setSettings({ ...settings, venice_api_key: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Model</Label>
                                            <Input value={settings.venice_model} onChange={(e) => setSettings({ ...settings, venice_model: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                                {settings.ai_provider === 'anthropic' && (
                                    <div className="space-y-4 border rounded p-4 bg-slate-50">
                                        <div className="space-y-1">
                                            <Label>Anthropic API Key</Label>
                                            <Input type="password" value={settings.anthropic_api_key} onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Model</Label>
                                            <Input value={settings.anthropic_model} onChange={(e) => setSettings({ ...settings, anthropic_model: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                                {settings.ai_provider === 'openrouter' && (
                                    <div className="space-y-4 border rounded p-4 bg-slate-50">
                                        <div className="space-y-1">
                                            <Label>OpenRouter API Key</Label>
                                            <Input type="password" value={settings.openrouter_api_key} onChange={(e) => setSettings({ ...settings, openrouter_api_key: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Model</Label>
                                            <Input value={settings.openrouter_model} onChange={(e) => setSettings({ ...settings, openrouter_model: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle>Voice (Cartesia)</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <Label>Cartesia API Key</Label>
                                        <Input type="password" value={settings.cartesia_api_key || ''} onChange={(e) => setSettings({ ...settings, cartesia_api_key: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Voice ID</Label>
                                        <Input value={settings.cartesia_voice_id || ''} onChange={(e) => setSettings({ ...settings, cartesia_voice_id: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Model ID</Label>
                                        <Input value={settings.cartesia_model_id || 'sonic-english'} onChange={(e) => setSettings({ ...settings, cartesia_model_id: e.target.value })} placeholder="sonic-english" />
                                    </div>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <input type="checkbox" id="voice_enabled" className="h-4 w-4" checked={settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true} onChange={(e) => setSettings({ ...settings, voice_response_enabled: e.target.checked })} />
                                        <Label htmlFor="voice_enabled">Enable Voice Replies</Label>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Long-Term Memory (Mem0)</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <Label>Mem0 API Key</Label>
                                        <Input type="password" placeholder="m0-..." value={settings.mem0_api_key || ''} onChange={(e) => setSettings({ ...settings, mem0_api_key: e.target.value })} />
                                        <p className="text-xs text-muted-foreground">Required for long-term memory.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* --- TAB: PERSONA --- */}
                {activeTab === 'persona' && (
                    <Card className="border-indigo-100 shadow-md">
                        <CardHeader className="bg-indigo-50/50">
                            <CardTitle>Agent Soul & Architecture</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-bold text-indigo-900">1. Identity Template</Label>
                                    <textarea className="w-full h-32 p-3 rounded-md border text-sm font-mono bg-slate-50" value={settings.prompt_identity_template || ''} onChange={(e) => setSettings({ ...settings, prompt_identity_template: e.target.value })} />
                                    <p className="text-xs text-muted-foreground">Vars: {'{{ROLE}}'}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-indigo-900">2. Context Template</Label>
                                    <textarea className="w-full h-32 p-3 rounded-md border text-sm font-mono bg-slate-50" value={settings.prompt_context_template || ''} onChange={(e) => setSettings({ ...settings, prompt_context_template: e.target.value })} />
                                    <p className="text-xs text-muted-foreground">Vars: {'{{USER_NAME}}, {{DAYS_ACTIVE}}, {{TRUST_SCORE}}'}</p>
                                </div>
                            </div>

                            <div className="border-t pt-6">
                                <Label className="text-lg font-bold text-indigo-900 mb-4 block">3. Phase Goals (The "Mission")</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    <div className="space-y-2 p-4 border rounded-lg bg-green-50/50 border-green-100">
                                        <Label className="text-green-800 font-semibold">Phase A: Connection</Label>
                                        <textarea className="w-full h-40 p-2 rounded border text-sm" value={settings.phase_prompt_connection || ''} onChange={(e) => setSettings({ ...settings, phase_prompt_connection: e.target.value })} />
                                    </div>
                                    <div className="space-y-2 p-4 border rounded-lg bg-yellow-50/50 border-yellow-100">
                                        <Label className="text-yellow-800 font-semibold">Phase B: Vulnerability</Label>
                                        <textarea className="w-full h-40 p-2 rounded border text-sm" value={settings.phase_prompt_vulnerability || ''} onChange={(e) => setSettings({ ...settings, phase_prompt_vulnerability: e.target.value })} />
                                    </div>
                                    <div className="space-y-2 p-4 border rounded-lg bg-red-50/50 border-red-100">
                                        <Label className="text-red-800 font-semibold">Phase C: Crisis</Label>
                                        <textarea className="w-full h-40 p-2 rounded border text-sm" value={settings.phase_prompt_crisis || ''} onChange={(e) => setSettings({ ...settings, phase_prompt_crisis: e.target.value })} />
                                    </div>
                                    <div className="space-y-2 p-4 border rounded-lg bg-purple-50/50 border-purple-100">
                                        <Label className="text-purple-800 font-semibold">Phase D: Money Pot 💰</Label>
                                        <textarea className="w-full h-40 p-2 rounded border text-sm" value={settings.phase_prompt_moneypot || ''} onChange={(e) => setSettings({ ...settings, phase_prompt_moneypot: e.target.value })} placeholder="Prompt for clients who have already paid..." />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t pt-6">
                                <div className="space-y-2">
                                    <Label className="font-bold text-indigo-900">4. Guardrails</Label>
                                    <textarea className="w-full h-32 p-3 rounded-md border text-sm" value={settings.prompt_guardrails || ''} onChange={(e) => setSettings({ ...settings, prompt_guardrails: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-indigo-900">5. Global Rules</Label>
                                    <textarea className="w-full h-32 p-3 rounded-md border text-sm" value={settings.prompt_global_rules || ''} onChange={(e) => setSettings({ ...settings, prompt_global_rules: e.target.value })} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* --- TAB: MODERATION --- */}
                {activeTab === 'moderation' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card>
                            <CardHeader><CardTitle>Blacklist Management</CardTitle></CardHeader>
                            <CardContent>
                                <BlacklistManager />
                            </CardContent>
                        </Card>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t flex justify-center z-50">
                    <Button type="submit" size="lg" disabled={saving || loading} className="w-full max-w-md shadow-xl transition-all hover:scale-105">
                        {saving ? 'Saving...' : '💾 Save All Settings'}
                    </Button>
                </div>
            </form>
        </div>
    )
}

function BlacklistManager() {
    const [rules, setRules] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')

    const fetchRules = useCallback(() => {
        axios.get('/api/blacklist').then(res => {
            setRules(res.data)
        })
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
            <div className="flex space-x-2">
                <Input
                    placeholder="Forbidden term (e.g. nudity, face, street)"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                />
                <Button type="button" variant="destructive" onClick={() => addRule('image')}>Block Photo</Button>
                <Button type="button" variant="destructive" onClick={() => addRule('video')}>Block Video</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-4 bg-red-50">
                    <h4 className="font-bold text-red-800 mb-2">Forbidden in Photos 🚫📸</h4>
                    <ul className="space-y-1">
                        {photoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white p-2 rounded shadow-sm">
                                <span>{rule.term}</span>
                                <button type="button" onClick={() => deleteRule(rule.id)} className="text-red-500 hover:text-red-700">×</button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="border rounded p-4 bg-red-50">
                    <h4 className="font-bold text-red-800 mb-2">Forbidden in Videos 🚫🎥</h4>
                    <ul className="space-y-1">
                        {videoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white p-2 rounded shadow-sm">
                                <span>{rule.term}</span>
                                <button type="button" onClick={() => deleteRule(rule.id)} className="text-red-500 hover:text-red-700">×</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}
