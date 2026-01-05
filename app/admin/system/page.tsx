'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Terminal, Play, Trash2, GitBranch, Power, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { AdminNav } from '@/components/admin-nav'

interface SystemStatus {
    connected: boolean
    user: string | null
    uptime: string
    uptimeSeconds: number
    memory: {
        heapUsed: string
        heapTotal: string
        rss: string
    }
    chatsLoaded: number
    lidMappings: number
    nodeVersion: string
    timestamp: string
}

export default function AdminSystemPage() {
    const [status, setStatus] = useState<SystemStatus | null>(null)
    const [logs, setLogs] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const logsRef = useRef<HTMLDivElement>(null)

    const BAILEYS_ENDPOINT = process.env.NEXT_PUBLIC_BAILEYS_ENDPOINT || 'http://56.228.15.237:3001'

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${BAILEYS_ENDPOINT}/api/admin/status`, {
                headers: { 'X-Admin-Key': process.env.NEXT_PUBLIC_AUTH_TOKEN || '' }
            })
            const data = await res.json()
            if (data.success) {
                setStatus(data.status)
            }
        } catch (e) {
            console.error('Failed to fetch status:', e)
        }
    }

    const fetchLogs = async () => {
        try {
            const res = await fetch(`${BAILEYS_ENDPOINT}/api/admin/logs?lines=100`, {
                headers: { 'X-Admin-Key': process.env.NEXT_PUBLIC_AUTH_TOKEN || '' }
            })
            const data = await res.json()
            if (data.success && data.lines) {
                setLogs(data.lines)
                // Auto-scroll to bottom
                if (logsRef.current) {
                    logsRef.current.scrollTop = logsRef.current.scrollHeight
                }
            }
        } catch (e) {
            console.error('Failed to fetch logs:', e)
        }
    }

    const executeAction = async (action: string) => {
        if (actionLoading) return

        // Confirmation for destructive actions
        if (['restart', 'clear_sessions'].includes(action)) {
            const confirmed = window.confirm(`Are you sure you want to ${action.replace('_', ' ')}? This will interrupt the service.`)
            if (!confirmed) return
        }

        setActionLoading(action)
        setActionResult(null)

        try {
            const res = await fetch(`${BAILEYS_ENDPOINT}/api/admin/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Key': process.env.NEXT_PUBLIC_AUTH_TOKEN || ''
                },
                body: JSON.stringify({ action })
            })
            const data = await res.json()
            setActionResult({ success: data.success, message: data.message || data.output || data.error || 'Unknown result' })
        } catch (e: any) {
            setActionResult({ success: false, message: e.message })
        } finally {
            setActionLoading(null)
        }
    }

    useEffect(() => {
        fetchStatus()
        fetchLogs()
        setLoading(false)

        // Auto-refresh
        let interval: NodeJS.Timeout | null = null
        if (autoRefresh) {
            interval = setInterval(() => {
                fetchStatus()
                fetchLogs()
            }, 5000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [autoRefresh])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <AdminNav />
            <main className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-white">System Administration</h1>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-400">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="rounded"
                            />
                            Auto-refresh (5s)
                        </label>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { fetchStatus(); fetchLogs() }}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400">Connection</p>
                                    <p className="text-xl font-bold text-white">
                                        {status?.connected ? 'Connected' : 'Disconnected'}
                                    </p>
                                </div>
                                {status?.connected ? (
                                    <CheckCircle className="h-8 w-8 text-green-500" />
                                ) : (
                                    <XCircle className="h-8 w-8 text-red-500" />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <p className="text-sm text-slate-400">Uptime</p>
                            <p className="text-xl font-bold text-white">{status?.uptime || '--'}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <p className="text-sm text-slate-400">Memory (Heap)</p>
                            <p className="text-xl font-bold text-white">{status?.memory?.heapUsed || '--'}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <p className="text-sm text-slate-400">Loaded Chats</p>
                            <p className="text-xl font-bold text-white">{status?.chatsLoaded ?? '--'}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions */}
                <Card className="bg-slate-800/50 border-slate-700 mb-8">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Power className="h-5 w-5" />
                            Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            <Button
                                variant="outline"
                                onClick={() => executeAction('git_pull')}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'git_pull' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
                                Git Pull
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => executeAction('restart')}
                                disabled={!!actionLoading}
                                className="border-yellow-500/50 hover:bg-yellow-500/10"
                            >
                                {actionLoading === 'restart' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Restart Container
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => executeAction('clear_sessions')}
                                disabled={!!actionLoading}
                                className="border-red-500/50 hover:bg-red-500/10"
                            >
                                {actionLoading === 'clear_sessions' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Clear Sessions
                            </Button>
                        </div>

                        {actionResult && (
                            <div className={`mt-4 p-3 rounded-lg ${actionResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                                <p className={`text-sm ${actionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {actionResult.message}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Logs */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Terminal className="h-5 w-5" />
                            Live Logs
                            <Badge variant="outline" className="ml-2">{logs.length} lines</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            ref={logsRef}
                            className="bg-black rounded-lg p-4 h-96 overflow-auto font-mono text-xs text-green-400"
                        >
                            {logs.length === 0 ? (
                                <p className="text-slate-500">No logs available</p>
                            ) : (
                                logs.map((line, i) => (
                                    <div key={i} className="hover:bg-slate-900 px-1">
                                        {line}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
