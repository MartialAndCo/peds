import { prisma } from "@/lib/prisma"
import { ScenariosTable } from "@/components/dashboard/scenarios-table"
import { Flame, PlayCircle, Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default async function AdminScenariosPage() {
    // Fetch scenarios
    const scenarios = await prisma.scenario.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { activeScenarios: true, media: true }
            }
        },
        take: 50 // Limit for now to prevent overload
    })

    const serializedScenarios = scenarios.map(s => ({
        ...s,
        createdAt: s.createdAt.toISOString()
    }))

    // Calculate generic stats (e.g. how many active right now)
    const activeRunningScenariosCount = await prisma.activeScenario.count({
        where: { status: 'RUNNING' }
    })

    const totalScenarioPayments = await prisma.scenarioPayment.aggregate({
        _sum: { amountPromised: true },
        where: { status: 'VALIDATED' }
    })
    const totalMoneyGenerated = totalScenarioPayments._sum.amountPromised ? Number(totalScenarioPayments._sum.amountPromised) : 0

    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Flame className="w-6 h-6 text-orange-500" />
                        Scenarios & Catastrophes
                    </h1>
                    <p className="text-white/40">Manage high-impact story scenarios and track their financial conversions.</p>
                </div>

                {/* Create Button */}
                <Link href="/admin/scenarios/new">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Scenario
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-white/40 text-sm">Active Targets</span>
                        <PlayCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{activeRunningScenariosCount}</p>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-white/40 text-sm">Scenarios Created</span>
                        <Flame className="w-4 h-4 text-orange-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{scenarios.length}</p>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-white/40 text-sm">Money Generated</span>
                        <span className="text-amber-400 font-bold">$</span>
                    </div>
                    <p className="text-3xl font-bold text-white">${totalMoneyGenerated.toLocaleString()}</p>
                </div>
            </div>

            {/* Table */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Scenario Library</h2>
                <ScenariosTable scenarios={serializedScenarios} />
            </div>
        </div>
    )
}
