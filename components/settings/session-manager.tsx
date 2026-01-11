'use client'

import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Power, RotateCcw } from 'lucide-react'
import QRCode from 'qrcode'

interface SessionManagerProps {
    settings: any
}

export function SessionManager({ settings }: SessionManagerProps) {
    const [status, setStatus] = useState<string>('STARTING')
    const [qr, setQr] = useState<string | null>(null)
    const [qrImage, setQrImage] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    const fetchStatus = useCallback(async () => {
        setLoading(true)
        try {
            const res = await axios.get('/api/waha/status')
            setStatus(res.data.status)
            setQr(res.data.qr)

            if (res.data.qr) {
                const url = await QRCode.toDataURL(res.data.qr)
                setQrImage(url)
            } else {
                setQrImage(null)
            }
        } catch (error) {
            console.error('Failed to fetch WAHA status:', error)
            setStatus('UNREACHABLE')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 15000) // Poll every 15s
        return () => clearInterval(interval)
    }, [fetchStatus])

    const handleAction = async (action: string) => {
        if (!confirm(`Are you sure you want to ${action} the session?`)) return
        setActionLoading(true)
        try {
            await axios.post('/api/admin/action', { action })
            setTimeout(fetchStatus, 2000) // Re-fetch after a short delay
        } catch (error) {
            console.error(`Failed to ${action} session:`, error)
            alert(`Failed to ${action} session`)
        } finally {
            setActionLoading(false)
        }
    }

    const getStatusColor = () => {
        switch (status) {
            case 'WORKING': return 'text-green-400 bg-green-500/10 border-green-500/20'
            case 'SCAN_QR_CODE': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
            case 'STOPPED': return 'text-red-400 bg-red-500/10 border-red-500/20'
            case 'STARTING': return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
            default: return 'text-white/40 bg-white/5 border-white/10'
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor()}`}>
                        {status}
                    </div>
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-white/20" />}
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={fetchStatus}
                        disabled={loading || actionLoading}
                        className="h-8 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5"
                    >
                        <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction('restart')}
                        disabled={actionLoading}
                        className="h-8 text-[10px] font-bold uppercase tracking-widest text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10"
                    >
                        <Power className="h-3 w-3 mr-2" />
                        Restart
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction('reset')}
                        disabled={actionLoading}
                        className="h-8 text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-500 hover:bg-red-500/10"
                    >
                        <RotateCcw className="h-3 w-3 mr-2" />
                        Reset
                    </Button>
                </div>
            </div>

            {status === 'SCAN_QR_CODE' && qrImage && (
                <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-white space-y-4">
                    <img src={qrImage} alt="WhatsApp QR Code" className="w-64 h-64" />
                    <p className="text-black text-sm font-medium">Scan this code with WhatsApp</p>
                    <div className="text-[10px] text-black/40 font-mono break-all max-w-xs text-center">
                        {qr}
                    </div>
                </div>
            )}

            {status === 'WORKING' && (
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                    <p className="text-green-400 text-sm font-medium">WhatsApp is connected and active.</p>
                    <p className="text-white/30 text-xs mt-1">New messages will be processed by the AI agents.</p>
                </div>
            )}

            {status === 'UNREACHABLE' && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                    <p className="text-red-400 text-sm font-medium">Baileys server is unreachable.</p>
                    <p className="text-white/30 text-xs mt-1">Check your WAHA endpoint configuration and ensure the server is running.</p>
                </div>
            )}
        </div>
    )
}
