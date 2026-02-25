"use client"

import { ArrowDown, ArrowUp, DollarSign, Users, Activity, MessageSquare, Zap, BrainCircuit } from "lucide-react"
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function AnalyticsGrid({ data }: { data: any }) {
    const {
        revenue, mrr, conversionRate, arpu,
        totalContacts, activeContacts, trustScoreAvg,
        messageVolume, avgMessagesPerContact,
        phaseDistribution,
        dailyActivity
    } = data

    // Trust score color
    const getTrustColor = (score: number) => {
        if (score > 70) return 'text-emerald-400'
        if (score > 40) return 'text-amber-400'
        return 'text-red-400'
    }

    const getTrustLabel = (score: number) => {
        if (score > 70) return 'Excellent'
        if (score > 40) return 'Neutral'
        return 'Caution'
    }

    return (
        <div className="space-y-6">
            {/* ROW 1: KEY FINANCIALS */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Revenue"
                    value={`$${revenue.toLocaleString()}`}
                    icon={DollarSign}
                    sub="Lifetime earnings"
                    trend="+12% vs last month"
                    trendUp={true}
                />
                <StatsCard
                    title="Monthly Recurring"
                    value={`$${mrr.toLocaleString()}`}
                    icon={Activity}
                    sub="Current Month"
                />
                <StatsCard
                    title="Conversion Rate"
                    value={`${conversionRate.toFixed(1)}%`}
                    icon={Zap}
                    sub="Of total contacts"
                />
                <StatsCard
                    title="ARPU"
                    value={`$${arpu.toFixed(2)}`}
                    icon={Users}
                    sub="Avg Rev Per User"
                />
            </div>

            {/* ROW 2: PSYCHOLOGY & FUNNEL */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Trust Score Gauge */}
                <div className="col-span-3 glass rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-white/60 mb-4">Average Trust Score</h3>
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className={`text-5xl font-bold tracking-tighter ${getTrustColor(trustScoreAvg)}`}>
                            {trustScoreAvg}
                        </div>
                        <p className={`mt-4 text-xs uppercase tracking-widest ${getTrustColor(trustScoreAvg)}`}>
                            {getTrustLabel(trustScoreAvg)}
                        </p>
                    </div>
                </div>

                {/* Funnel Phase Chart */}
                <div className="col-span-4 glass rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-white/60 mb-4">Funnel Distribution</h3>
                    <div className="h-[200px] w-full">
                        {phaseDistribution && phaseDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={phaseDistribution}>
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{
                                            background: '#1e293b',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                    />
                                    <Bar dataKey="value" fill="#ffffff" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/30 text-sm">
                                Not enough data
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ROW 3: ENGAGEMENT & ACTIVITY */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Volume (24h)"
                    value={messageVolume}
                    icon={MessageSquare}
                    sub="Messages exchanged"
                />
                <StatsCard
                    title="Avg Depth"
                    value={avgMessagesPerContact.toFixed(0)}
                    icon={BrainCircuit}
                    sub="Msgs per contact"
                />
                <StatsCard
                    title="AI Cost"
                    value={`$${data.veniceCost?.toFixed(4) || "0.0000"}`}
                    icon={BrainCircuit}
                    sub="Real Usage (Venice)"
                />
                <StatsCard
                    title="AI Balance"
                    value={data.veniceBalance != null ? `${data.veniceBalance.toFixed(2)} DIEM` : "N/A"}
                    icon={DollarSign}
                    sub="Available Balance"
                />
            </div>

            {/* ROW 4: ACTIVITY CHART */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white/60 mb-4">Daily Activity (Last 7 Days)</h3>
                <div className="h-[300px] w-full">
                    {dailyActivity && dailyActivity.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyActivity}>
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: '#fff'
                                    }}
                                />
                                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-white/30 text-sm">
                            No activity data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function StatsCard({ title, value, icon: Icon, sub, trend, trendUp }: any) {
    return (
        <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-white/40 text-sm">{title}</span>
                <Icon className="h-4 w-4 text-white/20" />
            </div>
            <div className="text-2xl font-semibold text-white">{value}</div>
            <p className="text-xs text-white/40 mt-1 flex items-center gap-1 h-4">
                {trend ? (
                    <span className={`flex items-center font-medium ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trendUp ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />} {trend}
                    </span>
                ) : (
                    <span>{sub}</span>
                )}
            </p>
        </div>
    )
}
