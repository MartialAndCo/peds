'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, QrCode, Power } from 'lucide-react'

export default function AgentConnectionPage({ params }: { params: { agentId: string } }) {
    const [agent, setAgent] = useState<any>(null)
    const [status, setStatus] = useState('UNKNOWN')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Poll status (Simplified global check for now, can be specific later)
    useEffect(() => {
        const fetchAgent = async () => {
            try {
                const res = await axios.get('/api/agents')
                const found = res.data.find((a: any) => a.id.toString() === params.agentId)
                setAgent(found)
                setLoading(false)
            } catch (e) { setLoading(false) }
        }
        fetchAgent()
    }, [params.agentId])

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await axios.get('/api/waha/status')
                let s = res.data.status || 'UNREACHABLE'
                // Check if session user matches agent phone
                if (s === 'WORKING' && res.data.me && agent && res.data.me.id.includes(agent.phone)) {
                    setStatus('CONNECTED')
                } else if (s === 'SCAN_QR_CODE') {
                    setStatus('SCAN_QR')
                } else {
                    setStatus(s) // STOPPED, etc.
                }
            } catch (e) { setStatus('ERROR') }
        }
        if (agent) checkStatus()
        const interval = setInterval(() => { if (agent) checkStatus() }, 5000)
        return () => clearInterval(interval)
    }, [agent])

    const startSession = async () => {
        if (!confirm('Start WAHA Session? This uses the Global Server config.')) return
        try {
            await axios.post('/api/session/start')
            // Show QR
            setQrCode('/api/waha/qr')
        } catch (e) { alert('Error starting') }
    }

    const stopSession = async () => {
        if (!confirm('Stop Session? This disconnects the agent.')) return
        try { await axios.post('/api/session/stop') } catch (e) { alert('Error stopping') }
    }

    if (loading) return <Loader2 className="animate-spin" />
    if (!agent) return <div>Agent not found</div>

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Connectivity</h1>
                <p className="text-slate-500">Manage WhatsApp connection for {agent.name}.</p>
            </div>

            <Card className={status === 'CONNECTED' ? 'border-emerald-500 border-2' : ''}>
                <CardHeader>
                    <CardTitle>Connection Status</CardTitle>
                    <CardDescription>
                        Target Phone: <span className="font-mono font-bold text-slate-800">{agent.phone}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">System Status</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' :
                                status === 'SCAN_QR' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {status}
                        </span>
                    </div>

                    {status === 'CONNECTED' && (
                        <div className="text-center py-6">
                            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <QrCode className="h-8 w-8 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-bold text-emerald-800">Agent is Online</h3>
                            <p className="text-sm text-emerald-600 mb-6">WhatsApp is actively connected.</p>
                            <Button variant="destructive" onClick={stopSession}>
                                <Power className="mr-2 h-4 w-4" /> Disconnect
                            </Button>
                        </div>
                    )}

                    {(status === 'STOPPED' || status === 'ERROR' || status === 'UNREACHABLE') && (
                        <div className="text-center py-6">
                            <p className="text-slate-500 mb-6">Session is currently stopped.</p>
                            <Button onClick={startSession}>Start Session & Scan QR</Button>
                        </div>
                    )}

                    {status === 'SCAN_QR' && (
                        <div className="text-center py-6 space-y-4">
                            <p className="font-bold text-orange-600 animate-pulse">Scan Now with WhatsApp (Linked Devices)</p>
                            <img src="/api/waha/qr" className="w-64 h-64 border-4 border-slate-900 rounded-xl mx-auto shadow-xl" />
                            <Button variant="outline" onClick={stopSession} className="mt-4">Cancel / Abort</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
