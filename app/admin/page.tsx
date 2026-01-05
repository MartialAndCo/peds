import { prisma } from "@/lib/prisma"
import { startOfMonth, subDays, format, startOfDay, endOfDay } from "date-fns"
import { Users, Bot, MessageSquare, TrendingUp } from "lucide-react"
import { AnalyticsGrid } from "@/components/dashboard/analytics-grid"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
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
            trustScoreAvg: 0,
            messageVolume: messageCount24h,
            avgMessagesPerContact: contactsCount > 0 ? totalMessages / contactsCount : 0,
            phaseDistribution: [],
            dailyActivity: dailyActivityRaw.reverse()
        }

        return (
            <div className="max-w-4xl space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-semibold text-white">Overview</h1>
                    <p className="text-white/40 text-sm mt-1">
                        System-wide metrics across {agentsCount} active agents
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-white/40 text-sm">Agents</span>
                            <Bot className="h-4 w-4 text-white/20" />
                        </div>
                        <p className="text-3xl font-semibold text-white">{agentsCount}</p>
                    </div>

                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-white/40 text-sm">Contacts</span>
                            <Users className="h-4 w-4 text-white/20" />
                        </div>
                        <p className="text-3xl font-semibold text-white">{contactsCount}</p>
                    </div>

                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-white/40 text-sm">Active Chats</span>
                            <MessageSquare className="h-4 w-4 text-white/20" />
                        </div>
                        <p className="text-3xl font-semibold text-white">{activeConversationsCount}</p>
                    </div>

                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-white/40 text-sm">Revenue</span>
                            <TrendingUp className="h-4 w-4 text-white/20" />
                        </div>
                        <p className="text-3xl font-semibold text-white">{revenue.toFixed(0)}€</p>
                    </div>
                </div>

                {/* Analytics Grid */}
                <div className="glass rounded-2xl p-6">
                    <AnalyticsGrid data={statsData} />
                </div>
            </div>
        )
    } catch (error: any) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-red-400">Error loading dashboard: {error.message}</p>
            </div>
        )
    }
}
