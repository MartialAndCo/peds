'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, MessageSquare, Users, Wifi, WifiOff, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AgentOverviewPage() {
    const { agentId } = useParams()
    const [agent, setAgent] = useState<any>(null)
    const [stats, setStats] = useState({ conversations: 0, messages: 0 })
    const [wahaStatus, setWahaStatus] = useState<string>('UNKNOWN')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
        const statusInterval = setInterval(fetchWahaStatus, 5000)
        return () => clearInterval(statusInterval)
    }, [agentId])

    const fetchData = async () => {
        try {
            // Fetch agent info
            const agentsRes = await axios.get('/api/agents')
            const found = agentsRes.data.find((a: any) => a.id.toString() === agentId)
            setAgent(found)

            // Fetch real stats for this agent
            const conversationsRes = await axios.get(`/api/conversations?agentId=${agentId}`)
            const conversations = conversationsRes.data
            const totalMessages = conversations.reduce((acc: number, c: any) => acc + (c._count?.messages || 0), 0)

            setStats({
                conversations: conversations.length,
                messages: totalMessages
            })

            // Initial WAHA status fetch
            await fetchWahaStatus()
        } catch (e) {
            console.error('Failed to fetch overview data:', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchWahaStatus = async () => {
        try {
            const res = await axios.get('/api/waha/status')
            const status = res.data.status
            if (status === 'WORKING') setWahaStatus('ONLINE')
            else if (status === 'SCAN_QR_CODE') setWahaStatus('SCANNING')
            else setWahaStatus('OFFLINE')
        } catch {
            setWahaStatus('UNREACHABLE')
        }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>
    if (!agent) return <div className="text-center text-slate-500 py-20">Agent not found</div>

    const statusConfig = {
        ONLINE: { icon: Wifi, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Connected' },
        SCANNING: { icon: Activity, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Awaiting QR Scan' },
        OFFLINE: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-100', label: 'Disconnected' },
        UNREACHABLE: { icon: WifiOff, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Service Unreachable' }
    }[wahaStatus] || { icon: WifiOff, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Unknown' }

    const StatusIcon = statusConfig.icon

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">My Desk</h1>
                <p className="text-slate-400">Welcome to {agent.name}'s workspace.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300">Total Conversations</CardTitle>
                        <MessageSquare className="h-4 w-4 text-sky-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white">{stats.conversations}</div>
                        <p className="text-xs text-slate-500">Active threads for this agent</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300">Messages Exchanged</CardTitle>
                        <Users className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white">{stats.messages}</div>
                        <p className="text-xs text-slate-500">Total across all conversations</p>
                    </CardContent>
                </Card>
                <Card className={cn("border-slate-700", statusConfig.bg.replace('bg-', 'bg-opacity-10 bg-'))}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300">WhatsApp Status</CardTitle>
                        <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-bold", statusConfig.color)}>{statusConfig.label}</div>
                        <p className="text-xs text-slate-500">Real-time connection</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-200">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <a href={`/workspace/${agentId}/conversations`} className="flex flex-col items-center p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                        <MessageSquare className="h-8 w-8 text-sky-400 group-hover:scale-110 transition-transform" />
                        <span className="mt-2 text-sm text-slate-300">View Chats</span>
                    </a>
                    <a href={`/workspace/${agentId}/connection`} className="flex flex-col items-center p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                        <Wifi className="h-8 w-8 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="mt-2 text-sm text-slate-300">Connectivity</span>
                    </a>
                    <a href={`/workspace/${agentId}/identity`} className="flex flex-col items-center p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                        <Users className="h-8 w-8 text-purple-400 group-hover:scale-110 transition-transform" />
                        <span className="mt-2 text-sm text-slate-300">Identity</span>
                    </a>
                    <a href={`/workspace/${agentId}/settings`} className="flex flex-col items-center p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                        <Activity className="h-8 w-8 text-amber-400 group-hover:scale-110 transition-transform" />
                        <span className="mt-2 text-sm text-slate-300">Settings</span>
                    </a>
                </CardContent>
            </Card>
        </div>
    )
}
