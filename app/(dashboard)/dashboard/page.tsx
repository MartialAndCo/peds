import { prisma } from "@/lib/prisma"
import { Separator } from "@/components/ui/separator"
import { AnalyticsGrid } from "@/components/dashboard/analytics-grid"
import { startOfMonth, subDays, format, startOfDay, endOfDay } from "date-fns"

import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic' // Ensure real-time data

export default async function DashboardPage() {
    const cookieStore = await cookies()
    const activeAgentIdRaw = cookieStore.get('activeAgentId')?.value
    const activeAgentId = activeAgentIdRaw ? parseInt(activeAgentIdRaw) : undefined

    // Filters
    const agentFilter: any = activeAgentId ? { agentId: activeAgentId } : {}
    const msgFilter: any = activeAgentId ? { conversation: { agentId: activeAgentId } } : {}
    const contactFilter: any = activeAgentId ? { conversations: { some: { agentId: activeAgentId } } } : {}
    const paymentFilter: any = activeAgentId ? { contact: { conversations: { some: { agentId: activeAgentId } } } } : {}

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
        // OPTIMIZATION: Prepare Daily Activity Promises (7 lightweight counts)
        const dailyActivityPromises = []
        for (let i = 0; i < 7; i++) {
            const date = subDays(new Date(), i)
            const start = startOfDay(date)
            const end = endOfDay(date)
            dailyActivityPromises.push(
                prisma.message.count({
                    where: {
                        timestamp: { gte: start, lte: end },
                        ...msgFilter
                    }
                }).then(count => ({ date: format(date, 'MMM dd'), count }))
            )
        }

        // 1. Fetch Raw Data in Parallel
        const [
            totalRevenueAgg,
            monthlyRevenueAgg,
            contactsCount,
            activeConversationsCount,
            messageCount24h,
            totalMessages,
            paymentsCount,
            trustScoreAgg,
            contactsByPhase,
            dailyActivityRaw
        ] = await Promise.all([
            // Revenue Total
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: paymentFilter
            }),
            // MRR (This Month)
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: {
                    createdAt: { gte: startOfMonth(new Date()) },
                    ...paymentFilter
                }
            }),
            // Counts
            prisma.contact.count({ where: contactFilter }),
            prisma.conversation.count({ where: { status: 'active', ...agentFilter } }),
            // Messages 24h
            prisma.message.count({ where: { timestamp: { gte: subDays(new Date(), 1) }, ...msgFilter } }),
            prisma.message.count({ where: msgFilter }),
            // Paying users count (approx by payments, ideal distinct contactId)
            prisma.payment.groupBy({
                by: ['contactId'],
                where: paymentFilter
            }),
            // Trust Score Avg
            prisma.contact.aggregate({
                _avg: { trustScore: true },
                where: contactFilter
            }),
            // Phase Distribution
            prisma.contact.groupBy({
                by: ['agentPhase'],
                _count: { agentPhase: true },
                where: contactFilter as any
            }),
            // Daily Activity (Last 7 days) - NOW OPTIMIZED
            Promise.all(dailyActivityPromises)
        ])

        // 2. Process Data
        const revenue = totalRevenueAgg._sum?.amount ? Number(totalRevenueAgg._sum.amount) : 0
        const mrr = monthlyRevenueAgg._sum?.amount ? Number(monthlyRevenueAgg._sum.amount) : 0
        const payingUsers = paymentsCount.length
        const conversionRate = contactsCount > 0 ? (payingUsers / contactsCount) * 100 : 0
        const arpu = payingUsers > 0 ? revenue / payingUsers : 0
        const trustScoreAvg = trustScoreAgg._avg?.trustScore ? Math.round(trustScoreAgg._avg.trustScore) : 0
        const avgMessagesPerContact = contactsCount > 0 ? totalMessages / contactsCount : 0

        // Format Phase Distribution
        const phaseMap: Record<string, number> = {}
        contactsByPhase.forEach((p: any) => {
            phaseMap[p.agentPhase] = p._count?.agentPhase || 0
        })
        const phaseDistribution = [
            { name: 'Connection', value: (phaseMap['CONNECTION'] || 0) + (phaseMap['new'] || 0) }, // Merge 'new' into Connection
            { name: 'Vulnerability', value: phaseMap['VULNERABILITY'] || 0 },
            { name: 'Crisis', value: phaseMap['CRISIS'] || 0 },
            { name: 'Money Pot', value: phaseMap['MONEYPOT'] || 0 }
        ]

        // Format Daily Activity
        // dailyActivityRaw is already array of { date, count } from our loop
        const dailyActivity = dailyActivityRaw.reverse()

        statsData = {
            revenue,
            mrr,
            conversionRate,
            arpu,
            totalContacts: contactsCount,
            activeContacts: activeConversationsCount,
            trustScoreAvg,
            messageVolume: messageCount24h,
            avgMessagesPerContact,
            phaseDistribution,
            dailyActivity
        }

    } catch (error: any) {
        console.error("DASHBOARD ANALYTICS ERROR:", error)
        // Fallback or Silent fail (UI will show zeros)
        // We log it so we can check server logs
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-400">
                    Analytics Overview
                </h2>
                <p className="text-muted-foreground">
                    Real-time insights from your agent's interactions and financials.
                </p>
            </div>
            <Separator />
            <AnalyticsGrid data={statsData} />
        </div>
    )
}
