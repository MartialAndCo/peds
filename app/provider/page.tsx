'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PlusCircle, Users, TrendingUp, DollarSign, Calendar } from 'lucide-react'
import Link from 'next/link'

interface ProviderStats {
    counts: {
        today: number
        thisWeek: number
        twoWeeks: number
        thisMonth: number
        allTime: number
    }
    status: {
        converted: number
        pending: number
        imported: number
    }
    byType: {
        WHATSAPP?: number
        DISCORD?: number
    }
    earnings: {
        total: number
        thisWeek: number
        perLead: number
    }
}

export default function ProviderDashboardPage() {
    const [stats, setStats] = useState<ProviderStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/provider/stats')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const StatCard = ({ 
        title, 
        value, 
        icon: Icon, 
        subtitle,
        href 
    }: { 
        title: string
        value: number | string
        icon: any
        subtitle?: string
        href?: string
    }) => (
        <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
                <Icon className="w-4 h-4 text-slate-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-white">{value}</div>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </CardContent>
            {href && (
                <div className="px-6 pb-4">
                    <Link href={href}>
                        <Button variant="ghost" size="sm" className="w-full text-blue-400 hover:text-blue-300 hover:bg-blue-950">
                            View Details
                        </Button>
                    </Link>
                </div>
            )}
        </Card>
    )

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48 bg-slate-800" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-32 bg-slate-800" />
                    ))}
                </div>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-400">Failed to load statistics</p>
                <Button onClick={fetchStats} variant="outline" className="mt-4">
                    Retry
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Dashboard</h2>
                    <p className="text-slate-400 mt-1">Track your lead performance</p>
                </div>
                <Link href="/provider/add">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Add Lead
                    </Button>
                </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Today"
                    value={stats.counts.today}
                    icon={Calendar}
                    subtitle="leads added"
                    href="/provider/history?period=today"
                />
                <StatCard
                    title="This Week"
                    value={stats.counts.thisWeek}
                    icon={TrendingUp}
                    subtitle="leads added"
                    href="/provider/history?period=week"
                />
                <StatCard
                    title="This Month"
                    value={stats.counts.thisMonth}
                    icon={Users}
                    subtitle="leads added"
                    href="/provider/history?period=month"
                />
                <StatCard
                    title="Total Leads"
                    value={stats.counts.allTime}
                    icon={Users}
                    subtitle="all time"
                    href="/provider/history"
                />
            </div>

            {/* Earnings Card */}
            <Card className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-blue-800">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-300 mb-1">Estimated Earnings</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-white">${stats.earnings.total}</span>
                                <span className="text-blue-300">total</span>
                            </div>
                            <p className="text-sm text-blue-400 mt-2">
                                ${stats.earnings.thisWeek} this week · ${stats.earnings.perLead} per lead
                            </p>
                        </div>
                        <div className="p-4 bg-blue-500/20 rounded-full">
                            <DollarSign className="w-8 h-8 text-blue-400" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Lead Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Converted</p>
                            <p className="text-xl font-bold text-green-400">{stats.status.converted}</p>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Imported</p>
                            <p className="text-xl font-bold text-blue-400">{stats.status.imported}</p>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Pending</p>
                            <p className="text-xl font-bold text-yellow-400">{stats.status.pending}</p>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    </CardContent>
                </Card>
            </div>

            {/* Lead Types */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white">Lead Types</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <span className="text-green-400 font-semibold">WA</span>
                                </div>
                                <div>
                                    <p className="font-medium text-white">WhatsApp</p>
                                    <p className="text-sm text-slate-500">Phone numbers</p>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-white">{stats.byType.WHATSAPP || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <span className="text-indigo-400 font-semibold">DC</span>
                                </div>
                                <div>
                                    <p className="font-medium text-white">Discord</p>
                                    <p className="text-sm text-slate-500">Usernames</p>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-white">{stats.byType.DISCORD || 0}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
