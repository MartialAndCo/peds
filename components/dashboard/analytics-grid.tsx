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
                    trend="+12% from last month"
                    trendUp={true}
                    color="green"
                />
                <StatsCard
                    title="MRR"
                    value={`$${mrr.toLocaleString()}`}
                    icon={Activity}
                    sub="Monthly Recurring Revenue"
                    color="blue"
                />
                <StatsCard
                    title="Conversion Rate"
                    value={`${conversionRate.toFixed(1)}%`}
                    icon={Zap}
                    sub="Of total contacts"
                    color="yellow"
                />
                <StatsCard
                    title="ARPU"
                    value={`$${arpu.toFixed(2)}`}
                    icon={Users}
                    sub="Avg Rev Per User"
                    color="violet"
                />
            </div>

            {/* ROW 2: PSYCHOLOGY & FUNNEL */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Trust Score Gauge (Visual) */}
                <Card className="col-span-3 border-l-4 border-l-pink-500 bg-white/50 dark:bg-gray-900/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Average Trust Score</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center pt-4">
                        <div className="relative flex items-center justify-center">
                            <div className="text-5xl font-bold text-pink-500">{trustScoreAvg}</div>
                        </div>
                        <p className="text-muted-foreground mt-2 text-sm text-center">
                            Target: 80+ for optimal conversion.
                            <br />
                            Current Sentiment: {trustScoreAvg > 70 ? "High Trust 💖" : trustScoreAvg > 40 ? "Neutral 😐" : "Skeptical 🤨"}
                        </p>
                    </CardContent>
                </Card>

                {/* Funnel Phase Chart */}
                <Card className="col-span-4 bg-white/50 dark:bg-gray-900/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Funnel Distribution (Agent Phases)</CardTitle>
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
                                    <Bar dataKey="value" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-indigo-500" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No funnel data available
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ROW 3: ENGAGEMENT & ACTIVITY */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatsCard
                    title="Msg Volume (24h)"
                    value={messageVolume}
                    icon={MessageSquare}
                    sub="Messages exchanged today"
                    color="sky"
                />
                <StatsCard
                    title="Avg Depth"
                    value={avgMessagesPerContact.toFixed(0)}
                    icon={BrainCircuit}
                    sub="Msgs per contact"
                    color="orange"
                />
                <StatsCard
                    title="Est. Token Usage"
                    value={`${(messageVolume * 150 / 1000).toFixed(1)}k`}
                    icon={BrainCircuit}
                    sub="Input/Output Tokens (est)"
                    color="gray"
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

function StatsCard({ title, value, icon: Icon, sub, trend, trendUp, color = "blue" }: any) {
    const colorClasses: any = {
        blue: "text-blue-600 border-l-blue-600 bg-blue-600/10",
        green: "text-green-600 border-l-green-600 bg-green-600/10",
        yellow: "text-yellow-600 border-l-yellow-600 bg-yellow-600/10",
        violet: "text-violet-600 border-l-violet-500 bg-violet-500/10",
        pink: "text-pink-600 border-l-pink-500 bg-pink-500/10",
        sky: "text-sky-500 border-l-sky-500 bg-sky-500/10",
        orange: "text-orange-500 border-l-orange-500 bg-orange-500/10",
        gray: "text-gray-500 border-l-gray-500 bg-gray-500/10",
    }

    return (
        <Card className={`border-l-4 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-default bg-white/50 backdrop-blur-sm dark:bg-gray-900/50 ${colorClasses[color].split(' ')[1]}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`p-2 rounded-full ${colorClasses[color].split(' ')[2]}`}>
                    <Icon className={`h-4 w-4 ${colorClasses[color].split(' ')[0]}`} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    {sub}
                    {trend && (
                        <span className={`ml-2 flex items-center font-medium ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                            {trendUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} {trend}
                        </span>
                    )}
                </p>
            </CardContent>
        </Card>
    )
}
