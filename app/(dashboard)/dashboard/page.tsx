import { prisma } from "@/lib/prisma"
import { Separator } from "@/components/ui/separator"
import { AnalyticsGrid } from "@/components/dashboard/analytics-grid"
import { startOfMonth, subDays, format } from "date-fns"

export const dynamic = 'force-dynamic' // Ensure real-time data

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
            prisma.payment.aggregate({ _sum: { amount: true } }),
            // MRR (This Month)
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { createdAt: { gte: startOfMonth(new Date()) } }
            }),
            // Counts
            prisma.contact.count(),
            prisma.conversation.count({ where: { status: 'active' } }),
            // Messages 24h
            prisma.message.count({ where: { timestamp: { gte: subDays(new Date(), 1) } } }),
            prisma.message.count(),
            // Paying users count (approx by payments, ideal distinct contactId)
            prisma.payment.groupBy({ by: ['contactId'] }),
            // Trust Score Avg
            prisma.contact.aggregate({ _avg: { trustScore: true } }),
            // Phase Distribution
            prisma.contact.groupBy({
                by: ['agentPhase'],
                _count: { agentPhase: true }
            }),
            // Daily Activity (Last 7 days) 
            prisma.message.findMany({
                where: { timestamp: { gte: subDays(new Date(), 7) } },
                select: { timestamp: true }
            })
        ])

        // 2. Process Data
        const revenue = totalRevenueAgg._sum.amount ? Number(totalRevenueAgg._sum.amount) : 0
        const mrr = monthlyRevenueAgg._sum.amount ? Number(monthlyRevenueAgg._sum.amount) : 0
        const payingUsers = paymentsCount.length
        const conversionRate = contactsCount > 0 ? (payingUsers / contactsCount) * 100 : 0
        const arpu = payingUsers > 0 ? revenue / payingUsers : 0
        const trustScoreAvg = trustScoreAgg._avg.trustScore ? Math.round(trustScoreAgg._avg.trustScore) : 0
        const avgMessagesPerContact = contactsCount > 0 ? totalMessages / contactsCount : 0

        // Format Phase Distribution
        const phaseMap: Record<string, number> = {}
        contactsByPhase.forEach(p => {
            phaseMap[p.agentPhase] = p._count.agentPhase
        })
        const phaseDistribution = [
            { name: 'Connection', value: (phaseMap['CONNECTION'] || 0) + (phaseMap['new'] || 0) }, // Merge 'new' into Connection
            { name: 'Vulnerability', value: phaseMap['VULNERABILITY'] || 0 },
            { name: 'Crisis', value: phaseMap['CRISIS'] || 0 },
            { name: 'Money Pot', value: phaseMap['MONEYPOT'] || 0 }
        ]

        // Format Daily Activity
        const activityMap: Record<string, number> = {}
        for (let i = 0; i < 7; i++) {
            const dateKey = format(subDays(new Date(), i), 'MMM dd')
            activityMap[dateKey] = 0
        }
        dailyActivityRaw.forEach(m => {
            const dateKey = format(m.timestamp, 'MMM dd')
            if (activityMap[dateKey] !== undefined) activityMap[dateKey]++
        })
        const dailyActivity = Object.keys(activityMap).reverse().map(key => ({
            date: key,
            count: activityMap[key]
        }))

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
