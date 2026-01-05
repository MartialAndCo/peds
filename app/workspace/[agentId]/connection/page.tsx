'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, QrCode, Power, Radio } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function AgentConnectionPage() {
    const { agentId } = useParams()
    const [agent, setAgent] = useState<any>(null)
    const [status, setStatus] = useState('UNKNOWN')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Settings state
    const [settings, setSettings] = useState({
        source_phone_number: '',
        media_source_number: '',
        voice_source_number: '',
        lead_provider_number: '',
    })

    useEffect(() => {
        const fetchAgent = async () => {
            try {
                const res = await axios.get('/api/agents')
                const found = res.data.find((a: any) => a.id.toString() === agentId)
                if (found) {
                    setAgent(found)
                    // Map settings array to state
                    const s = { ...settings }
                    found.settings?.forEach((item: any) => {
                        if (item.key in s) s[item.key as keyof typeof s] = item.value
                    })
                    setSettings(s)
                }
                setLoading(false)
            } catch (e) { setLoading(false) }
        }
        fetchAgent()
    }, [agentId])

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await axios.get('/api/waha/status')
                let s = res.data.status || 'UNREACHABLE'
                if (s === 'WORKING' && res.data.me && agent && res.data.me.id.includes(agent.phone)) {
                    setStatus('CONNECTED')
                } else if (s === 'SCAN_QR_CODE') {
                    setStatus('SCAN_QR')
                } else {
                    setStatus(s)
                }
            } catch (e) { setStatus('ERROR') }
        }
        if (agent) checkStatus()
        const interval = setInterval(() => { if (agent) checkStatus() }, 5000)
        return () => clearInterval(interval)
    }, [agent])

    const handleSaveSettings = async () => {
        setSaving(true)
        try {
            await axios.put(`/api/agents/${agentId}`, {
                ...agent,
                settings
            })
            alert('Phone configurations saved for this agent.')
        } catch (e) {
            alert('Error saving settings')
        } finally {
            setSaving(false)
        }
    }

    const startSession = async () => {
        if (!confirm('Start WAHA Session? This uses the Global Server config.')) return
        try {
            await axios.post('/api/session/start')
        } catch (e) { alert('Error starting') }
    }

    const stopSession = async () => {
        if (!confirm('Stop Session? This disconnects the agent.')) return
        try { await axios.post('/api/session/stop') } catch (e) { alert('Error stopping') }
    }

    if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>
    if (!agent) return <div>Agent not found</div>

    return (
        <div className="max-w-4xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Connectivity & Ingestion</h1>
                <p className="text-slate-500">Manage WhatsApp connection and ingestion phones for {agent.name}.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* WHATSAPP CONNECTION */}
                <Card className={status === 'CONNECTED' ? 'border-emerald-500 border-2 shadow-md' : 'shadow-sm'}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Radio className="h-5 w-5 text-emerald-600" />
                            WhatsApp Status
                        </CardTitle>
                        <CardDescription>
                            Session: <span className="font-mono font-bold text-slate-800">{agent.phone}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="font-medium text-slate-700">Status</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' :
                                status === 'SCAN_QR' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {status}
                            </span>
                        </div>

                        {status === 'CONNECTED' && (
                            <div className="text-center py-4">
                                <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-200">
                                    <div className="h-8 w-8 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <h3 className="text-lg font-bold text-emerald-800">🎉 Agent is Online!</h3>
                                <p className="text-sm text-emerald-600 mb-6">Device linked successfully. Ready to send and receive messages.</p>
                                <Button variant="destructive" size="sm" onClick={stopSession}>
                                    <Power className="mr-2 h-4 w-4" /> Disconnect Session
                                </Button>
                            </div>
                        )}

                        {(status === 'STOPPED' || status === 'ERROR' || status === 'UNREACHABLE' || status === 'UNKNOWN') && (
                            <div className="text-center py-6">
                                <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Power className="h-8 w-8 text-slate-400" />
                                </div>
                                <p className="text-slate-600 font-medium mb-2">Session is not active</p>
                                <p className="text-slate-400 text-sm mb-6">Click below to initialize the WhatsApp connection.</p>
                                <Button onClick={startSession} className="w-full">Initialize Session</Button>
                            </div>
                        )}

                        {status === 'STARTING' && (
                            <div className="text-center py-6">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                                <p className="text-blue-700 font-bold">Starting Session...</p>
                                <p className="text-slate-500 text-sm">Please wait while the WhatsApp service initializes.</p>
                            </div>
                        )}

                        {status === 'SCAN_QR' && (
                            <div className="text-center py-4 space-y-4">
                                <p className="font-bold text-orange-600 animate-pulse text-sm uppercase tracking-wider">📱 Scan QR Code with WhatsApp</p>
                                <div className="relative inline-block">
                                    <img
                                        src={`/api/waha/qr?t=${Date.now()}`}
                                        alt="WhatsApp QR Code"
                                        className="w-56 h-56 border-4 border-slate-900 rounded-xl shadow-xl"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f1f5f9" width="200" height="200"/><text fill="%2394a3b8" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">Loading QR...</text></svg>'
                                        }}
                                    />
                                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white text-[10px] px-2 py-1 rounded-full font-bold">
                                        Auto-refresh every 5s
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">Open WhatsApp on your phone → Menu → Linked Devices → Link a Device</p>
                                <Button variant="ghost" size="sm" onClick={stopSession} className="text-slate-500">Abort Initialization</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* INGESTION PHONES */}
                <Card className="shadow-sm border-2 border-blue-50">
                    <CardHeader className="bg-blue-50/30">
                        <CardTitle className="text-blue-900 border-none">Ingestion Phones</CardTitle>
                        <CardDescription className="text-blue-700/60">Define who can interact with {agent.name} for admin/media/leads.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-slate-500 font-bold">Admin Number</Label>
                            <Input
                                value={settings.source_phone_number}
                                onChange={e => setSettings({ ...settings, source_phone_number: e.target.value })}
                                placeholder="+336..."
                            />
                            <p className="text-[10px] text-slate-400">Can send system commands (reset, stats).</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-slate-500 font-bold">Lead Provider</Label>
                            <Input
                                value={settings.lead_provider_number}
                                onChange={e => setSettings({ ...settings, lead_provider_number: e.target.value })}
                                placeholder="+336..."
                            />
                            <p className="text-[10px] text-slate-400">Authorized to inject new leads/context.</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-slate-500 font-bold">Media Source</Label>
                            <Input
                                value={settings.media_source_number}
                                onChange={e => setSettings({ ...settings, media_source_number: e.target.value })}
                                placeholder="+336..."
                            />
                            <p className="text-[10px] text-slate-400">Receives photo/video requests from {agent.name}.</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-slate-500 font-bold">Voice Source</Label>
                            <Input
                                value={settings.voice_source_number}
                                onChange={e => setSettings({ ...settings, voice_source_number: e.target.value })}
                                placeholder="+336..."
                            />
                            <p className="text-[10px] text-slate-400">Receives audio recording requests.</p>
                        </div>

                        <Button
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                            onClick={handleSaveSettings}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Phone Config'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

