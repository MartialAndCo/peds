'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, TrendingUp, Users, MessageSquare, Bot, ArrowRight, Activity, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface MobileAdminDashboardProps {
    stats: any
    agentsCount: number
}

import { NotificationManager } from '@/components/notification-manager'

export function MobileAdminDashboard({ stats, agentsCount }: MobileAdminDashboardProps) {
    const router = useRouter()
    const [unreadCount, setUnreadCount] = useState(0)

    // Quick greeting based on time
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

    // Format daily activity for chart - with safety check
    const chartData = Array.isArray(stats?.dailyActivity)
        ? stats.dailyActivity.map((d: any) => ({
            name: d.date || '',
            messages: d.count || 0
        }))
        : []

    useEffect(() => {
        // Fetch unread count
        fetch('/api/notifications?limit=1')
            .then(res => res.json())
            .then(data => {
                if (data.unreadCount) setUnreadCount(data.unreadCount)
            })
            .catch(console.error)
    }, [])

    return (
        <div className="min-h-screen pb-24 space-y-8">
            <NotificationManager />

            {/* Header Section */}
            <div className="pt-2 px-5 pwa-safe-area-top-margin flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">{greeting},<br /><span className="text-blue-500">Admin</span></h1>
                    <p className="text-white/40 text-sm mt-1 font-medium">Here's what's happening today.</p>
                </div>
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-white/5 hover:bg-white/10 text-white relative"
                        onClick={() => router.push('/admin/notifications')}
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 box-shadow-glow-red animate-pulse" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Stats Carousel (Horizontal Scroll) */}
            <div className="w-full overflow-x-auto pwa-hide-scrollbar px-5 pb-2">
                <div className="flex gap-4 w-max">
                    {/* Revenue Card */}
                    <div className="w-40 h-40 glass rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign className="h-16 w-16 text-emerald-400" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1">Revenue</span>
                            <span className="text-2xl font-bold text-white">{stats.revenue.toFixed(0)}€</span>
                        </div>
                    </div>

                    {/* Active Chats Card */}
                    <div className="w-40 h-40 glass rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <MessageSquare className="h-16 w-16 text-blue-400" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1">Active</span>
                            <span className="text-2xl font-bold text-white">{stats.activeContacts}</span>
                        </div>
                    </div>

                    {/* Agents Card */}
                    <div className="w-40 h-40 glass rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Bot className="h-16 w-16 text-purple-400" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1">Agents</span>
                            <span className="text-2xl font-bold text-white">{agentsCount}</span>
                        </div>
                    </div>

                    {/* Total Users Card */}
                    <div className="w-40 h-40 glass rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users className="h-16 w-16 text-amber-400" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Users className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1">Contacts</span>
                            <span className="text-2xl font-bold text-white">{stats.totalContacts}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Action / Highlight */}
            <div className="px-5">
                <div
                    onClick={() => router.push('/admin/agents')}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 relative overflow-hidden shadow-lg shadow-blue-900/40 active:scale-[0.98] transition-all cursor-pointer"
                >
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h3 className="text-white font-bold text-lg">Manage Agents</h3>
                            <p className="text-white/70 text-sm mt-1">Check status & configure bots</p>
                        </div>
                        <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <ArrowRight className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    {/* Decor */}
                    <Bot className="absolute -bottom-4 -right-4 h-32 w-32 text-black/10 rotate-12" />
                </div>
            </div>

            {/* Activity Chart Section */}
            <div className="px-5">
                <div className="glass rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-white font-bold">Activity Trend</h3>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-xs">+12.5%</Badge>
                    </div>

                    <div className="h-[200px] w-full" style={{ minWidth: 100, minHeight: 100 }}>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: '#ffffff40', fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickMargin={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="messages"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorMessages)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/30 text-sm">
                                No activity data
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Links Grid */}
            <div className="px-5">
                <h3 className="text-white/40 font-bold uppercase text-xs tracking-widest mb-4 px-1">Quick Access</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div onClick={() => router.push('/admin/conversations')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center">
                        <MessageSquare className="h-6 w-6 text-pink-400" />
                        <span className="text-white text-sm font-medium">All Chats</span>
                    </div>
                    <div onClick={() => router.push('/admin/payments')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center">
                        <DollarSign className="h-6 w-6 text-green-400" />
                        <span className="text-white text-sm font-medium">Payments</span>
                    </div>
                    <div onClick={() => router.push('/admin/voices')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center">
                        <Activity className="h-6 w-6 text-amber-400" />
                        <span className="text-white text-sm font-medium">Voices</span>
                    </div>
                    <div onClick={() => router.push('/admin/settings')} className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors cursor-pointer text-center">
                        <Activity className="h-6 w-6 text-white/60" />
                        <span className="text-white text-sm font-medium">Settings</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
