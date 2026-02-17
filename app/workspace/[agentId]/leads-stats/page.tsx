'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import {
    Loader2,
    ArrowLeft,
    Users,
    TrendingUp,
    CheckCircle2,
    Clock,
    BarChart3,
    AlertCircle,
    Calendar,
    DollarSign,
    MessageCircle,
    Gamepad2
} from 'lucide-react'
import { usePWAMode } from '@/hooks/use-pwa-mode'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface Lead {
    id: string
    type: 'WHATSAPP' | 'DISCORD'
    identifier: string
    source: string
    status: 'PENDING' | 'IMPORTED' | 'CONVERTED' | 'REJECTED'
    createdAt: string
    contact?: {
        id: string
        status: string
    }
}

interface StatsData {
    counts: {
        today: number
        thisWeek: number
        thisMonth: number
        allTime: number
    }
    status: {
        converted: number
        pending: number
        imported: number
    }
    byType: Record<string, number>
    earnings: {
        total: number
        thisWeek: number
        perLead: number
    }
    conversionRate: number
    recentLeads: Lead[]
}

const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    IMPORTED: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    CONVERTED: 'bg-green-500/20 text-green-400 border-green-500/50',
    REJECTED: 'bg-red-500/20 text-red-400 border-red-500/50'
}

export default function LeadsStatsPage() {
    const { isPWAStandalone } = usePWAMode()
    const router = useRouter()
    const { agentId } = useParams()

    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get(`/api/agents/${agentId}/leads/stats`)
                setStats(res.data)
            } catch (err: any) {
                console.error('Failed to fetch stats:', err)
                setError(err.response?.data?.error || 'Failed to load statistics')
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [agentId])

    const PWAHeader = () => (
        <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] py-3 px-4 pwa-safe-area-top-margin mb-6 flex items-center gap-3 shadow-sm">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 -ml-2"
                onClick={() => router.back()}
            >
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-white">Leads Stats</h1>
        </div>
    )

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-6 w-6 text-white/40" />
        </div>
    )

    if (error) return (
        <div className="p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 mb-2">
                <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Error</h2>
            <p className="text-white/40">{error}</p>
            <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-white/10 text-white hover:bg-white/5"
            >
                Try Again
            </Button>
        </div>
    )

    if (!stats) return null

    return (
        <div className="space-y-6 pb-24">
            {isPWAStandalone ? <PWAHeader /> : (
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Leads Dashboard</h1>
                        <p className="text-white/40 text-sm mt-1">
                            Track the performance and costs of leads assigned to this agent
                        </p>
                    </div>
                </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Today"
                    value={stats.counts.today}
                    icon={Calendar}
                    subtitle="leads received"
                />
                <StatCard
                    title="This Week"
                    value={stats.counts.thisWeek}
                    icon={TrendingUp}
                    subtitle="leads received"
                />
                <StatCard
                    title="This Month"
                    value={stats.counts.thisMonth}
                    icon={Users}
                    subtitle="leads received"
                />
                <StatCard
                    title="Total Leads"
                    value={stats.counts.allTime}
                    icon={Users}
                    subtitle="all time"
                />
            </div>

            {/* Costs Card */}
            <Card className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border-white/[0.06] overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-300 font-medium mb-1">Estimated Lead Costs</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-white">${stats.earnings.total}</span>
                                <span className="text-blue-300/60 text-sm font-medium">total expenses</span>
                            </div>
                            <p className="text-sm text-blue-400/80 mt-2 font-medium">
                                ${stats.earnings.thisWeek} this week · ${stats.earnings.perLead} per lead
                            </p>
                        </div>
                        <div className="p-4 bg-blue-500/20 rounded-2xl">
                            <DollarSign className="w-8 h-8 text-blue-400" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Lead Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatusSummaryCard label="Converted" value={stats.status.converted} color="bg-emerald-500" textColor="text-emerald-400" />
                <StatusSummaryCard label="Imported" value={stats.status.imported} color="bg-blue-500" textColor="text-blue-400" />
                <StatusSummaryCard label="Pending" value={stats.status.pending} color="bg-amber-500" textColor="text-amber-400" />
            </div>

            {/* Recent Leads History */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-400" />
                    Recent Leads Details
                </h3>

                <div className="space-y-3">
                    {stats.recentLeads.length === 0 ? (
                        <Card className="glass border-white/[0.06] p-8 text-center">
                            <p className="text-white/20">No leads found for this agent</p>
                        </Card>
                    ) : (
                        stats.recentLeads.map((lead) => (
                            <Card key={lead.id} className="glass border-white/[0.06] hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                {lead.type === 'WHATSAPP' ? (
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                                        <Gamepad2 className="w-4 h-4 text-indigo-400" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-medium text-white text-sm truncate">
                                                        {lead.identifier}
                                                    </p>
                                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{lead.source}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] text-white/30">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {format(new Date(lead.createdAt), 'MMM d, HH:mm')}
                                                </span>
                                            </div>
                                        </div>

                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] py-0 px-2 h-5 rounded-full border-0 ${statusColors[lead.status]}`}
                                        >
                                            {lead.status}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon: Icon, subtitle }: any) {
    return (
        <Card className="glass border-white/[0.06]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-white/40">{title}</CardTitle>
                <Icon className="w-4 h-4 text-white/20" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-white">{value}</div>
                {subtitle && <p className="text-[10px] font-medium text-white/30 mt-1">{subtitle}</p>}
            </CardContent>
        </Card>
    )
}

function StatusSummaryCard({ label, value, color, textColor }: any) {
    return (
        <Card className="glass border-white/[0.06]">
            <CardContent className="p-4 flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-white/40">{label}</p>
                    <p className={`text-xl font-bold ${textColor}`}>{value}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${color} shadow-[0_0_10px_rgba(255,255,255,0.1)]`} />
            </CardContent>
        </Card>
    )
}
