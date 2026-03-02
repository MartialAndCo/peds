'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import { Loader2, MessageSquare, Wifi, WifiOff, Settings, Fingerprint, Zap, Sparkles, OctagonAlert, Play } from 'lucide-react'
import { toast } from 'sonner'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { usePWAMode } from '@/hooks/use-pwa-mode'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentQuickAdd } from '@/components/dashboard/agent-quick-add'
import { MobileSmartAdd } from '@/components/pwa/pages/mobile-smart-add'

export default function AgentOverviewPage() {
    const { isPWAStandalone } = usePWAMode()
    const router = useRouter()
    const { agentId } = useParams()
    const safeAgentId = agentId as string
    const numericAgentId = undefined // Deprecated

    const [agent, setAgent] = useState<any>(null)
    const [stats, setStats] = useState({ conversations: 0, messages: 0 })
    const [wahaStatus, setWahaStatus] = useState<string>('UNKNOWN')
    const [loading, setLoading] = useState(true)
    const [smartAddOpen, setSmartAddOpen] = useState(false)
    const [isEmergencyStopLoading, setIsEmergencyStopLoading] = useState(false)
    const [isEmergencyDialogOpen, setIsEmergencyDialogOpen] = useState(false)

    // Render logic update for PWA Header
    const PWAHeader = () => (
        <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] py-3 px-4 pwa-safe-area-top-margin mb-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 -ml-2"
                    onClick={() => router.push('/admin')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold text-white">Overview</h1>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="destructive"
                    size="icon"
                    className={`h-9 w-9 ${!agent?.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : 'animate-pulse'}`}
                    onClick={() => !agent?.isActive ? handleResumeAI() : setIsEmergencyDialogOpen(true)}
                    disabled={isEmergencyStopLoading}
                >
                    {isEmergencyStopLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        !agent?.isActive ? <Play className="h-4 w-4" /> : <OctagonAlert className="h-4 w-4" />}
                </Button>
                <Button
                    onClick={() => setSmartAddOpen(true)}
                    className="h-9 px-3 text-sm bg-amber-500 hover:bg-amber-600 text-black"
                >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Smart Lead
                </Button>
            </div>
        </div>
    )

    const fetchData = async () => {
        try {
            const agentsRes = await axios.get('/api/agents')
            const agentsData = Array.isArray(agentsRes.data) ? agentsRes.data : []
            const found = agentsData.find((a: any) => a.id.toString() === agentId)
            setAgent(found)

            const conversationsRes = await axios.get(`/api/conversations?agentId=${agentId}`)
            const conversations = conversationsRes.data
            const totalMessages = conversations.reduce((acc: number, c: any) => acc + (c._count?.messages || 0), 0)

            setStats({
                conversations: conversations.length,
                messages: totalMessages
            })

            await fetchWahaStatus()
        } catch (e) {
            console.error('Failed to fetch overview data:', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchWahaStatus = async () => {
        try {
            const res = await axios.get(`/api/waha/status?agentId=${agentId}`)
            const status = res.data.status
            if (status === 'WORKING') setWahaStatus('ONLINE')
            else if (status === 'SCAN_QR_CODE') setWahaStatus('SCANNING')
            else setWahaStatus('OFFLINE')
        } catch {
            setWahaStatus('UNREACHABLE')
        }
    }

    const handleEmergencyStop = async () => {
        setIsEmergencyStopLoading(true)
        try {
            await axios.post(`/api/agents/${agentId}/emergency-stop`, { action: 'freeze' })
            toast.success('Emergency Stop Engaged. Queues cleared.')
            await fetchData()
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to engage emergency stop')
        } finally {
            setIsEmergencyStopLoading(false)
            setIsEmergencyDialogOpen(false)
        }
    }

    const handleResumeAI = async () => {
        setIsEmergencyStopLoading(true)
        try {
            await axios.post(`/api/agents/${agentId}/emergency-stop`, { action: 'resume' })
            toast.success('AI Resumed successfully.')
            await fetchData()
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to resume AI')
        } finally {
            setIsEmergencyStopLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const statusInterval = setInterval(fetchWahaStatus, 5000)
        return () => clearInterval(statusInterval)
    }, [agentId])

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-6 w-6 text-white/40" />
        </div>
    )

    if (!agent) return (
        <div className="text-center text-white/40 py-20">Agent not found</div>
    )

    return (
        <div className="space-y-8">
            {/* Smart Add Sheet (PWA) */}
            {isPWAStandalone && (
                <MobileSmartAdd
                    open={smartAddOpen}
                    onOpenChange={setSmartAddOpen}
                    agentId={safeAgentId}
                    onSuccess={() => fetchData()}
                />
            )}

            {isPWAStandalone ? <PWAHeader /> : (
                /* Desktop Header */
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold text-white">Overview</h1>
                            {!agent.isActive && (
                                <span className="bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider animate-pulse">
                                    Frozen / STOPPED
                                </span>
                            )}
                        </div>
                        <p className="text-white/40 text-sm mt-1">
                            {agent.name}'s workspace dashboard
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant={agent.isActive ? "destructive" : "default"}
                            className={agent.isActive ? "bg-red-600 hover:bg-red-700 font-bold" : "bg-emerald-600 hover:bg-emerald-700 font-bold"}
                            onClick={() => agent.isActive ? setIsEmergencyDialogOpen(true) : handleResumeAI()}
                            disabled={isEmergencyStopLoading}
                        >
                            {isEmergencyStopLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                                agent.isActive ? <OctagonAlert className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}

                            {agent.isActive ? 'EMERGENCY STOP' : 'RESUME AI'}
                        </Button>
                        <AgentQuickAdd agentId={numericAgentId} />
                    </div>
                </div>
            )}

            {/* Emergency Stop Alert Dialog */}
            <AlertDialog open={isEmergencyDialogOpen} onOpenChange={setIsEmergencyDialogOpen}>
                <AlertDialogContent className="bg-red-950/90 border-red-900 !text-red-50">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-400 font-bold text-xl flex items-center gap-2">
                            <OctagonAlert className="h-6 w-6" />
                            ENGAGE EMERGENCY STOP?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-red-200/80">
                            This action will immediately:
                            <ul className="list-disc ml-5 mt-2 space-y-1 font-medium text-red-200">
                                <li>Disable AI generation for {agent.name}.</li>
                                <li>Cancel ALL pending AI responses.</li>
                                <li>Clear ALL outgoing message queues.</li>
                                <li>Pause all active conversations.</li>
                            </ul>
                            <p className="mt-4 text-white font-semibold">
                                The AI will be completely frozen until you click Resume. Are you sure?
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-red-800 text-red-200 hover:bg-red-900 hover:text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => { e.preventDefault(); handleEmergencyStop(); }}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold"
                        >
                            YES, FREEZE AI NOW
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Conversations */}
                <div className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-white/40 text-sm">Conversations</span>
                        <MessageSquare className="h-4 w-4 text-white/20" />
                    </div>
                    <p className="text-3xl font-semibold text-white">{stats.conversations}</p>
                </div>

                {/* Messages */}
                <div className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-white/40 text-sm">Messages</span>
                        <MessageSquare className="h-4 w-4 text-white/20" />
                    </div>
                    <p className="text-3xl font-semibold text-white">{stats.messages}</p>
                </div>

                {/* Connection Status */}
                <div className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-white/40 text-sm">WhatsApp</span>
                        {wahaStatus === 'ONLINE' ? (
                            <Wifi className="h-4 w-4 text-emerald-400" />
                        ) : wahaStatus === 'SCANNING' ? (
                            <Wifi className="h-4 w-4 text-amber-400" />
                        ) : (
                            <WifiOff className="h-4 w-4 text-red-400" />
                        )}
                    </div>
                    <p className={`text-xl font-medium ${wahaStatus === 'ONLINE' ? 'text-emerald-400' :
                        wahaStatus === 'SCANNING' ? 'text-amber-400' :
                            'text-red-400'
                        }`}>
                        {wahaStatus === 'ONLINE' ? 'Connected' :
                            wahaStatus === 'SCANNING' ? 'Awaiting Scan' :
                                'Disconnected'}
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass rounded-2xl p-6">
                <h2 className="text-white font-medium mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link
                        href={`/workspace/${agentId}/conversations`}
                        className="flex flex-col items-center p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors group"
                    >
                        <MessageSquare className="h-6 w-6 text-white/40 group-hover:text-white transition-colors" />
                        <span className="mt-2 text-sm text-white/60 group-hover:text-white">Conversations</span>
                    </Link>
                    <Link
                        href={`/workspace/${agentId}/connection`}
                        className="flex flex-col items-center p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors group"
                    >
                        <Zap className="h-6 w-6 text-white/40 group-hover:text-white transition-colors" />
                        <span className="mt-2 text-sm text-white/60 group-hover:text-white">Connectivity</span>
                    </Link>
                    <Link
                        href={`/workspace/${agentId}/identity`}
                        className="flex flex-col items-center p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors group"
                    >
                        <Fingerprint className="h-6 w-6 text-white/40 group-hover:text-white transition-colors" />
                        <span className="mt-2 text-sm text-white/60 group-hover:text-white">Identity</span>
                    </Link>
                    <Link
                        href={`/workspace/${agentId}/settings`}
                        className="flex flex-col items-center p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors group"
                    >
                        <Settings className="h-6 w-6 text-white/40 group-hover:text-white transition-colors" />
                        <span className="mt-2 text-sm text-white/60 group-hover:text-white">Settings</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
