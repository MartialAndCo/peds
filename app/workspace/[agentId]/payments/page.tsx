import { prisma } from "@/lib/prisma"
import { PaymentsTable } from "@/components/dashboard/payments-table"
import { DollarSign, TrendingUp } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function AgentPaymentsPage({ params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params
    const id = parseInt(agentId)

    // Strategy: Verify agent ownership.
    // Since Phase 1 "Payment" model doesn't store agentId directly,
    // we fetch payments for contacts that have handled a conversation with this agent
    // OR simply show payments for contacts 'assigned' to this agent if that concept exists.
    // For now, looking at 'conversations' is a safe proxy, or we add agentId to payment in future.
    // Wait -> schema says Contact has agentPhase but not direct agentId. 
    // BUT Conversation has agentId.
    // So we fetch payments where Contact has AT LEAST ONE conversation with this agent.

    // Better yet, let's just fetch ALL payments for now and filter by contacts who interacted with this agent?
    // Actually, `Contact` belongs to the system. 
    // Let's rely on `Conversation` history.

    const payments = await prisma.payment.findMany({
        where: {
            contact: {
                conversations: {
                    some: {
                        agentId: id
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            contact: {
                select: {
                    name: true,
                    phone_whatsapp: true
                }
            }
        }
    })

    const agent = await prisma.agent.findUnique({
        where: { id: id },
        select: { name: true }
    })

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)

    const serializedPayments = payments.map(p => ({
        ...p,
        amount: Number(p.amount),
        createdAt: p.createdAt.toISOString()
    }))

    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{agent?.name || 'Agent'} Payments</h1>
                    <p className="text-white/40">Revenue attributed to this agent's contacts</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-white/40 text-sm">Agent Revenue</span>
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
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
                <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
                <PaymentsTable payments={serializedPayments} />
            </div>
        </div>
    )
}
