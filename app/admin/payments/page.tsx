import { prisma } from "@/lib/prisma"
import { PaymentsTable } from "@/components/dashboard/payments-table"
import { DollarSign, TrendingUp, Calendar } from "lucide-react"
import { startOfMonth, subDays } from "date-fns"

export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage() {
    // Fetch payments
    const payments = await prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            contact: {
                select: {
                    name: true,
                    phone_whatsapp: true
                }
            }
        },
        take: 100 // Limit for now to prevent overload
    })

    // Calculate stats
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const thisMonth = startOfMonth(new Date())
    const monthRevenue = payments
        .filter(p => new Date(p.createdAt) >= thisMonth)
        .reduce((sum, p) => sum + Number(p.amount), 0)

    // Convert Decimal to Number for serialization
    const serializedPayments = payments.map(p => ({
        ...p,
        amount: Number(p.amount),
        createdAt: p.createdAt.toISOString(),
        contact: p.contact ? {
            name: p.contact.name,
            phone_whatsapp: p.contact.phone_whatsapp || 'N/A'
        } : null
    }))

    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Payments</h1>
                    <p className="text-white/40">Manage and track all global transactions</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-white/40 text-sm">Total Revenue</span>
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-white/40 text-sm">This Month</span>
                        <Calendar className="w-4 h-4 text-purple-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">${monthRevenue.toLocaleString()}</p>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-white/40 text-sm">Transactions</span>
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{payments.length}</p>
                </div>
            </div>

            {/* Table */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
                <PaymentsTable payments={serializedPayments} />
            </div>
        </div>
    )
}
