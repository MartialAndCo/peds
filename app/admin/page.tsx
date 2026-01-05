import { prisma } from "@/lib/prisma"
import { Separator } from "@/components/ui/separator"
import { AnalyticsGrid } from "@/components/dashboard/analytics-grid"
import { startOfMonth, subDays, format, startOfDay, endOfDay } from "date-fns"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Users, Bot, MessageSquare, TrendingUp, Activity } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    // SYSTEM DASHBOARD: No agent filtering here. 
    // This is the global view for the administrator.

    let statsData = {
        revenue: 0,
        mrr: 0,
        conversionRate: 0,
        arpu: 0,
        totalContacts: 0,
        activeContacts: 0,
        trustScoreAvg: 0,
        messageVolume: 0,
        avgMessagesPerContact: 0,
        phaseDistribution: [] as any[],
        dailyActivity: [] as any[]
    }

    try {
        const dailyActivityPromises = []
        for (let i = 0; i < 7; i++) {
            const date = subDays(new Date(), i)
            const start = startOfDay(date)
            const end = endOfDay(date)
            dailyActivityPromises.push(
                prisma.message.count({
                    where: { timestamp: { gte: start, lte: end } }
                }).then(count => ({ date: format(date, 'MMM dd'), count }))
            )
        }

        const [
            totalRevenueAgg,
            monthlyRevenueAgg,
            contactsCount,
            activeConversationsCount,
            messageCount24h,
            totalMessages,
            paymentsCount,
            agentsCount,
            dailyActivityRaw
        ] = await Promise.all([
            prisma.payment.aggregate({ _sum: { amount: true } }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { createdAt: { gte: startOfMonth(new Date()) } }
            }),
            prisma.contact.count(),
            prisma.conversation.count({ where: { status: 'active' } }),
            prisma.message.count({ where: { timestamp: { gte: subDays(new Date(), 1) } } }),
            prisma.message.count(),
            prisma.payment.groupBy({ by: ['contactId'] }),
            prisma.agent.count({ where: { isActive: true } }),
            Promise.all(dailyActivityPromises)
        ])

        const revenue = totalRevenueAgg._sum?.amount ? Number(totalRevenueAgg._sum.amount) : 0
        const mrr = monthlyRevenueAgg._sum?.amount ? Number(monthlyRevenueAgg._sum.amount) : 0
        const payingUsers = paymentsCount.length

        statsData = {
            revenue,
            mrr,
            conversionRate: contactsCount > 0 ? (payingUsers / contactsCount) * 100 : 0,
            arpu: payingUsers > 0 ? revenue / payingUsers : 0,
            totalContacts: contactsCount,
            activeContacts: activeConversationsCount,
            trustScoreAvg: 0, // Global trust avg might not be relevant or we can add it
            messageVolume: messageCount24h,
            avgMessagesPerContact: contactsCount > 0 ? totalMessages / contactsCount : 0,
            phaseDistribution: [], // We can skip phase distribution for global or aggregate it
            dailyActivity: dailyActivityRaw.reverse()
        }

        return (
            <div className="flex flex-col gap-8 pb-10">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">System Overview</h2>
                    <p className="text-slate-500 font-medium">
                        Global performance metrics across all <span className="text-emerald-600 font-bold">{agentsCount} active agents</span>.
                    </p>
                </div>

                <Separator />

                {/* FAST STATS ROW */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                            <Bot className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agentsCount}</div>
                            <p className="text-xs text-muted-foreground font-medium">Currently online & active</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Global Contacts</CardTitle>
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{contactsCount}</div>
                            <p className="text-xs text-muted-foreground font-medium">Across all agent networks</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
                            <MessageSquare className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{activeConversationsCount}</div>
                            <p className="text-xs text-muted-foreground font-medium">Pending AI responses</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{revenue.toFixed(2)}€</div>
                            <p className="text-xs text-muted-foreground font-medium">Aggregated financials</p>
                        </CardContent>
                    </Card>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-4">
                    <AnalyticsGrid data={statsData} />
                </div>
            </div>
        )
    } catch (error: any) {
        return <div className="p-20 text-center text-red-500">Error loading global dashboard: {error.message}</div>
    }
}
