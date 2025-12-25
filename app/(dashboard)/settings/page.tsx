'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        waha_endpoint: '',
        waha_session: 'default',
        waha_api_key: '',
        venice_api_key: '',
        venice_model: 'venice-uncensored',
        anthropic_api_key: '',
        anthropic_model: 'claude-3-haiku-20240307',
        ai_provider: 'venice'
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [wahaStatus, setWahaStatus] = useState<string>('UNKNOWN')
    const [wahaMe, setWahaMe] = useState<any>(null)

    const fetchSettings = useCallback(() => {
        axios.get('/api/settings').then(res => {
            setSettings((prev: any) => ({ ...prev, ...res.data }))
            setLoading(false)
        }).catch(e => console.error(e))
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    // Poll WAHA Status
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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>

            <form onSubmit={handleSave} className="space-y-6">

                {/* WAHA Status Card */}
                <Card className="border-2 border-blue-50">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>WhatsApp Connection Status</CardTitle>
                            <Badge variant={wahaStatus === 'WORKING' ? 'default' : 'destructive'}>
                                {wahaStatus}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col items-center justify-center min-h-[150px]">
                        {wahaStatus === 'SCAN_QR' && (
                            <div className="text-center space-y-2">
                                <p className="font-medium">Scan this QR Code with WhatsApp</p>
                                <img
                                    src="/api/waha/qr"
                                    alt="WhatsApp QR Code"
                                    className="w-64 h-64 border rounded-md"
                                />
                                <div className="pt-4">
                                    <Button variant="destructive" onClick={async () => {
                                        setWahaStatus('STOPPING')
                                        try {
                                            await axios.post('/api/session/stop')
                                            setWahaStatus('STOPPED')
                                        } catch (e: any) {
                                            alert('Failed to stop session')
                                            setWahaStatus('UNKNOWN')
                                        }
                                    }}>
                                        Stop Session
                                    </Button>
                                </div>
                            </div>
                        )}
                        {wahaStatus === 'WORKING' && wahaMe && (
                            <div className="text-center text-green-600 space-y-4">
                                <div>
                                    <p className="text-xl font-bold">Connected!</p>
                                    <p>{wahaMe.pushName || 'WhatsApp User'}</p>
                                    <p className="text-sm opacity-70">{wahaMe.id}</p>
                                </div>
                                <Button variant="destructive" onClick={async () => {
                                    setWahaStatus('STOPPING')
                                    try {
                                        await axios.post('/api/session/stop')
                                        setWahaStatus('STOPPED')
                                    } catch (e: any) {
                                        alert('Failed to stop session')
                                        setWahaStatus('UNKNOWN')
                                    }
                                }}>
                                    Stop Session
                                </Button>
                            </div>
                        )}
                        {wahaStatus === 'UNREACHABLE' && (
                            <div className="text-center text-red-500">
                                <p>Cannot connect to WAHA Server.</p>
                                <p className="text-xs">Ensure WAHA is running at {settings.waha_endpoint || 'http://localhost:3001'}</p>
                            </div>
                        )}
                        {wahaStatus === 'STOPPED' && (
                            <div className="text-center text-orange-500 space-y-4">
                                <p>Session is currently stopped.</p>
                                <Button onClick={async () => {
                                    setWahaStatus('STARTING')
                                    try {
                                        const res = await axios.post('/api/session/start')
                                        // Status should update on next poll
                                    } catch (e: any) {
                                        const msg = e.response?.data?.error || e.message
                                        alert(`Failed to start session: ${msg}`)
                                        setWahaStatus('STOPPED')
                                    }
                                }}>
                                    Start Session
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Global AI Provider</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <Button
                                type="button"
                                variant={settings.ai_provider === 'venice' ? 'default' : 'outline'}
                                onClick={() => setSettings({ ...settings, ai_provider: 'venice' })}
                                className="w-1/2"
                            >
                                Venice AI
                            </Button>
                            <Button
                                type="button"
                                variant={settings.ai_provider === 'anthropic' ? 'default' : 'outline'}
                                onClick={() => setSettings({ ...settings, ai_provider: 'anthropic' })}
                                className="w-1/2"
                            >
                                Anthropic
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {settings.ai_provider === 'venice' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Venice AI Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    value={settings.venice_api_key}
                                    onChange={(e) => setSettings({ ...settings, venice_api_key: e.target.value })}
                                    placeholder="sk-..."
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Default Model</Label>
                                <Input
                                    value={settings.venice_model}
                                    onChange={(e) => setSettings({ ...settings, venice_model: e.target.value })}
                                    placeholder="venice-uncensored"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {settings.ai_provider === 'anthropic' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Anthropic Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    value={settings.anthropic_api_key}
                                    onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                                    placeholder="sk-ant-..."
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Default Model</Label>
                                <Input
                                    value={settings.anthropic_model}
                                    onChange={(e) => setSettings({ ...settings, anthropic_model: e.target.value })}
                                    placeholder="claude-3-haiku-20240307"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Voice Generation Configuration (Cartesia AI)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cartesia_api_key">Cartesia API Key</Label>
                            <Input
                                id="cartesia_api_key"
                                type="password"
                                value={settings.cartesia_api_key || ''}
                                onChange={(e) => setSettings({ ...settings, cartesia_api_key: e.target.value })}
                                placeholder="sk_cartesia_..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cartesia_voice_id">Cartesia Voice ID</Label>
                            <Input
                                id="cartesia_voice_id"
                                value={settings.cartesia_voice_id || ''}
                                onChange={(e) => setSettings({ ...settings, cartesia_voice_id: e.target.value })}
                                placeholder="e.g. e8e5fffb-..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cartesia_model_id">Cartesia Model ID</Label>
                            <Input
                                id="cartesia_model_id"
                                value={settings.cartesia_model_id || 'sonic-english'}
                                onChange={(e) => setSettings({ ...settings, cartesia_model_id: e.target.value })}
                                placeholder="sonic-english or sonic-multilingual"
                            />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="voice_enabled"
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                checked={settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true}
                                onChange={(e) => setSettings({ ...settings, voice_response_enabled: e.target.checked })}
                            />
                            <Label htmlFor="voice_enabled">Enable Voice Replies (Reply Voice if Incoming Voice)</Label>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>WAHA Configuration (WhatsApp)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label>Endpoint URL</Label>
                            <Input
                                value={settings.waha_endpoint}
                                onChange={(e) => setSettings({ ...settings, waha_endpoint: e.target.value })}
                                placeholder="http://localhost:3001"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>API Key</Label>
                            <Input
                                value={settings.waha_api_key}
                                type="password"
                                onChange={(e) => setSettings({ ...settings, waha_api_key: e.target.value })}
                                placeholder="secret"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Session Name</Label>
                            <Input
                                value={settings.waha_session}
                                onChange={(e) => setSettings({ ...settings, waha_session: e.target.value })}
                                placeholder="default"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>AI Memory (Mem0)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="mem0_api_key">Mem0 API Key</Label>
                            <Input
                                id="mem0_api_key"
                                type="password"
                                placeholder="m0-..."
                                value={settings.mem0_api_key || ''}
                                onChange={(e) => setSettings({ ...settings, mem0_api_key: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Required for long-term memory. Get it from <a href="https://app.mem0.ai" className="underline" target="_blank">Mem0 Platform</a>.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Media Content Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="source_phone_number">Source Phone Number (Admin)</Label>
                            <Input
                                id="source_phone_number"
                                placeholder="+336..."
                                value={settings.source_phone_number || ''}
                                onChange={(e) => setSettings({ ...settings, source_phone_number: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                The WhatsApp number that will receive media requests (e.g. "Send me a photo of...").
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Blacklist Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>Blacklist Management (Forbidden Content)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <BlacklistManager />
                    </CardContent>
                    {/* Dynamic Prompts Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Agent Persona & Architecture (Professional)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label>1. Identity Template</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                        value={settings.prompt_identity_template || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_identity_template: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Variables: {'{{ROLE}}'}</p>
                                </div>

                                <div className="space-y-2">
                                    <Label>2. Context Template</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                        value={settings.prompt_context_template || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_context_template: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Variables: {'{{USER_NAME}}, {{CURRENT_DATE}}, {{DAYS_ACTIVE}}, {{TRUST_SCORE}}, {{PHASE}}'}</p>
                                </div>

                                <div className="border-t pt-4">
                                    <Label className="text-lg font-semibold">Phase Goals (The "Mission")</Label>
                                    <p className="text-sm text-gray-500 mb-4">The AI will use ONE of these based on the active phase.</p>

                                    <div className="space-y-4 pl-4 border-l-2 border-slate-200">
                                        <div className="space-y-2">
                                            <Label>Phase A: Connection (Start)</Label>
                                            <textarea
                                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                                                value={settings.phase_prompt_connection || ''}
                                                onChange={(e) => setSettings({ ...settings, phase_prompt_connection: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phase B: Vulnerability (Mid)</Label>
                                            <textarea
                                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                                                value={settings.phase_prompt_vulnerability || ''}
                                                onChange={(e) => setSettings({ ...settings, phase_prompt_vulnerability: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phase C: Crisis (High Trust)</Label>
                                            <textarea
                                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                                                value={settings.phase_prompt_crisis || ''}
                                                onChange={(e) => setSettings({ ...settings, phase_prompt_crisis: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>4. Guardrails (Safety & Style)</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                        value={settings.prompt_guardrails || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_guardrails: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>5. Global Critical Rules (Language, Realism)</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                        value={settings.prompt_global_rules || ''}
                                        onChange={(e) => setSettings({ ...settings, prompt_global_rules: e.target.value })}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pb-10">
                        <Button type="submit" disabled={saving || loading}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
            </form>
        </div>
    )
}

function BlacklistManager() {
    const [rules, setRules] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')
    const [loading, setLoading] = useState(true)

    const fetchRules = useCallback(() => {
        axios.get('/api/blacklist').then(res => {
            setRules(res.data)
            setLoading(false)
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
                        {photoRules.length === 0 && <li className="text-gray-400 text-xs italic">No rules</li>}
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
                        {videoRules.length === 0 && <li className="text-gray-400 text-xs italic">No rules</li>}
                    </ul>
                </div>
            </div>
        </div>
    )
}
