'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Power, Wifi, WifiOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function AgentConnectionPage() {
    const { agentId } = useParams()
    const [agent, setAgent] = useState<any>(null)
    const [status, setStatus] = useState('UNKNOWN')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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
                const res = await axios.get(`/api/waha/status?agentId=${agentId}`)
                let s = res.data.status || 'UNREACHABLE'
                if (s === 'WORKING') setStatus('CONNECTED')
                else if (s === 'SCAN_QR_CODE') setStatus('SCAN_QR')
                else if (s === 'STOPPED' || s === 'DISCONNECTED') setStatus('STOPPED')
                else setStatus(s)
            } catch (e) { setStatus('ERROR') }
        }
        if (agent) checkStatus()
        const interval = setInterval(() => { if (agent) checkStatus() }, 5000)
        return () => clearInterval(interval)
    }, [agent, agentId])

    const handleSaveSettings = async () => {
        setSaving(true)
        try {
            await axios.put(`/api/agents/${agentId}`, { ...agent, settings })
        } catch (e) {
            console.error('Error saving settings')
        } finally {
            setSaving(false)
        }
    }

    const startSession = async () => {
        if (!confirm('Start WhatsApp Session?')) return
        try {
            await axios.post('/api/session/start', { agentId })
            setStatus('STARTING')
        } catch (e) { console.error('Error starting session') }
    }

    const stopSession = async () => {
        if (!confirm('Stop Session?')) return
        try {
            await axios.post('/api/session/stop', { agentId })
            setStatus('STOPPED')
        } catch (e) { console.error('Error stopping') }
    }

    const resetSession = async () => {
        if (!agentId) return
        if (!confirm('Reset Session? This will clear all auth data and require a new QR scan.')) return
        try {
            setStatus('STARTING')
            await axios.post('/api/session/reset', { sessionId: agentId.toString() })
        } catch (e) { console.error('Error resetting session') }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-6 w-6 text-white/40" />
        </div>
    )

    if (!agent) return (
        <div className="text-white/60 text-center py-20">Agent not found</div>
    )

    return (
        <div className="space-y-8 max-w-5xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-white">Connectivity</h1>
                <p className="text-white/40 text-sm mt-1">
                    Manage WhatsApp connection for {agent.name}
                </p>
            </div>

            {/* WhatsApp Status Card */}
            <div className="glass rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {status === 'CONNECTED' ? (
                            <Wifi className="h-5 w-5 text-emerald-400" />
                        ) : status === 'SCAN_QR' ? (
                            <Wifi className="h-5 w-5 text-amber-400" />
                        ) : status === 'STARTING' ? (
                            <Wifi className="h-5 w-5 text-blue-400" />
                        ) : (
                            <WifiOff className="h-5 w-5 text-red-400" />
                        )}
                        <span className="text-white font-medium">WhatsApp</span>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        status === 'SCAN_QR' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            status === 'STARTING' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        {status === 'CONNECTED' ? 'Connected' :
                            status === 'SCAN_QR' ? 'Awaiting Scan' :
                                status === 'STARTING' ? 'Starting...' :
                                    'Disconnected'}
                    </div>
                </div>

                {/* Connected State */}
                {status === 'CONNECTED' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <div className="w-4 h-4 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <p className="text-emerald-400 font-medium mb-1">Session Active</p>
                        <p className="text-white/40 text-sm mb-6">Ready to send and receive messages</p>
                        <Button
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                            onClick={stopSession}
                        >
                            <Power className="h-4 w-4 mr-2" />
                            Disconnect
                        </Button>
                    </div>
                )}

                {/* Disconnected State */}
                {(status === 'STOPPED' || status === 'ERROR' || status === 'UNREACHABLE' || status === 'UNKNOWN') && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <Power className="h-6 w-6 text-red-400" />
                        </div>
                        <p className="text-white font-medium mb-1">Session Inactive</p>
                        <p className="text-white/40 text-sm mb-6">Click below to start or reset WhatsApp</p>
                        <div className="flex gap-3 justify-center">
                            <Button
                                className="bg-white text-black hover:bg-white/90"
                                onClick={startSession}
                            >
                                Initialize Session
                            </Button>
                            <Button
                                variant="ghost"
                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
                                onClick={resetSession}
                            >
                                Reset & Clear Data
                            </Button>
                        </div>
                    </div>
                )}

                {/* Starting State */}
                {status === 'STARTING' && (
                    <div className="text-center py-8">
                        <Loader2 className="h-10 w-10 animate-spin text-white/40 mx-auto mb-4" />
                        <p className="text-white font-medium mb-1">Starting Session</p>
                        <p className="text-white/40 text-sm">Please wait...</p>
                    </div>
                )}

                {/* QR Code State */}
                {status === 'SCAN_QR' && (
                    <div className="text-center py-6 space-y-4">
                        <p className="text-yellow-500 text-sm font-medium">Scan QR Code with WhatsApp</p>
                        <div className="inline-block p-3 bg-white rounded-2xl">
                            <img
                                src={`/api/waha/qr?t=${Date.now()}`}
                                alt="QR Code"
                                className="w-48 h-48"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                }}
                            />
                        </div>
                        <p className="text-white/30 text-xs">
                            Open WhatsApp → Settings → Linked Devices → Link a Device
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/40 hover:text-white"
                            onClick={stopSession}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>

            {/* Phone Configuration */}
            <div className="glass rounded-2xl p-6 space-y-6">
                <div>
                    <h2 className="text-white font-medium">Phone Configuration</h2>
                    <p className="text-white/40 text-sm mt-1">
                        Define authorized phone numbers for this agent
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                            Admin Number
                        </label>
                        <Input
                            value={settings.source_phone_number}
                            onChange={e => setSettings({ ...settings, source_phone_number: e.target.value })}
                            placeholder="+33..."
                            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                            Lead Provider
                        </label>
                        <Input
                            value={settings.lead_provider_number}
                            onChange={e => setSettings({ ...settings, lead_provider_number: e.target.value })}
                            placeholder="+33..."
                            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                            Media Source
                        </label>
                        <Input
                            value={settings.media_source_number}
                            onChange={e => setSettings({ ...settings, media_source_number: e.target.value })}
                            placeholder="+33..."
                            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                            Voice Source
                        </label>
                        <Input
                            value={settings.voice_source_number}
                            onChange={e => setSettings({ ...settings, voice_source_number: e.target.value })}
                            placeholder="+33..."
                            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                        />
                    </div>
                </div>

                <Button
                    className="w-full bg-white text-black hover:bg-white/90"
                    onClick={handleSaveSettings}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Configuration'}
                </Button>
            </div>
        </div>
    )
}
