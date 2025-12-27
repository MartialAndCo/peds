"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDown, ArrowUp, DollarSign, Users, Activity, MessageSquare, Zap, Clock, ShieldCheck, HeartCrack, BrainCircuit } from "lucide-react"
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function AnalyticsGrid({ data }: { data: any }) {
    const {
        revenue, mrr, conversionRate, arpu,
        totalContacts, activeContacts, trustScoreAvg,
        messageVolume, avgMessagesPerContact,
        phaseDistribution,
        dailyActivity
    } = data

    return (
        <div className="space-y-8">
            {/* ROW 1: KEY FINANCIALS (The "Board" view) */}
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
                {/* Trust Score Gauge (Visual) */}
                <Card className="col-span-3 border-border/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Average Trust Score</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center pt-4">
                        <div className="relative flex items-center justify-center">
                            <div className="text-5xl font-bold tracking-tighter">{trustScoreAvg}</div>
                        </div>
                        <p className="text-muted-foreground mt-4 text-xs text-center uppercase tracking-widest">
                            {trustScoreAvg > 70 ? "Excellent" : trustScoreAvg > 40 ? "Neutral" : "Caution"}
                        </p>
                    </CardContent>
                </Card>

                {/* Funnel Phase Chart */}
                <Card className="col-span-4 border-border/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Funnel Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px]">
                        {phaseDistribution && phaseDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={phaseDistribution}>
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="value" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary/80" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                Not enough data
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ROW 3: ENGAGEMENT & ACTIVITY */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    title="Token Usage"
                    value={`${(messageVolume * 150 / 1000).toFixed(1)}k`}
                    icon={BrainCircuit}
                    sub="Estimated usage"
                />
            </div>

            {/* ROW 4: ACTIVITY CHART */}
            <Card className="col-span-4 bg-white/50 dark:bg-gray-900/50">
                <CardHeader>
                    <CardTitle>Daily Activity (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent className="pl-2 h-[300px]">
                    {dailyActivity && dailyActivity.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyActivity}>
                                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip />
                                <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                            No activity data available
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    )
}

function StatsCard({ title, value, icon: Icon, sub, trend, trendUp }: any) {
    return (
        <Card className="hover:shadow-md transition-shadow duration-200 cursor-default bg-card dark:bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground/70" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 h-4">
                    {trend ? (
                        <span className={`flex items-center font-medium ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {trendUp ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />} {trend}
                        </span>
                    ) : (
                        <span>{sub}</span>
                    )}
                </p>
            </CardContent>
        </Card>
    )
}
