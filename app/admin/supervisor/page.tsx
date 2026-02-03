/**
 * Supervisor Dashboard
 * Page de supervision des IA - Vue d'ensemble des alertes
 */

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SupervisorClient } from "./client";

export const dynamic = "force-dynamic";

export default async function SupervisorPage() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }

    // Récupérer les statistiques globales
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalAlerts, criticalAlerts, newAlerts, agents] = await Promise.all([
        prisma.supervisorAlert.count({
            where: { createdAt: { gte: last24h } }
        }),
        prisma.supervisorAlert.count({
            where: {
                severity: "CRITICAL",
                status: "NEW"
            }
        }),
        prisma.supervisorAlert.count({
            where: { status: "NEW" }
        }),
        prisma.agent.findMany({
            where: { isActive: true },
            select: { id: true, name: true, color: true }
        })
    ]);

    // Statistiques par gravité
    const severityStats = await prisma.supervisorAlert.groupBy({
        by: ["severity"],
        where: { status: "NEW" },
        _count: { severity: true }
    });

    const stats = {
        total: totalAlerts,
        critical: severityStats.find(s => s.severity === "CRITICAL")?._count?.severity || 0,
        high: severityStats.find(s => s.severity === "HIGH")?._count?.severity || 0,
        medium: severityStats.find(s => s.severity === "MEDIUM")?._count?.severity || 0,
        low: severityStats.find(s => s.severity === "LOW")?._count?.severity || 0,
        new: newAlerts
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                        🤖 Supervisor AI
                        {stats.critical > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                {stats.critical} CRITICAL
                            </span>
                        )}
                    </h1>
                    <p className="text-white/40 text-sm mt-1">
                        Monitoring de santé des agents IA - {totalAlerts} alertes 24h
                    </p>
                </div>
                <div className="flex gap-2">
                    <a
                        href="/admin"
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm"
                    >
                        ← Retour Dashboard
                    </a>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="glass rounded-xl p-4 border-l-4 border-red-500">
                    <div className="text-white/40 text-sm">🔴 Critical</div>
                    <div className="text-2xl font-bold text-white mt-1">{stats.critical}</div>
                </div>
                <div className="glass rounded-xl p-4 border-l-4 border-orange-500">
                    <div className="text-white/40 text-sm">🟠 High</div>
                    <div className="text-2xl font-bold text-white mt-1">{stats.high}</div>
                </div>
                <div className="glass rounded-xl p-4 border-l-4 border-yellow-500">
                    <div className="text-white/40 text-sm">🟡 Medium</div>
                    <div className="text-2xl font-bold text-white mt-1">{stats.medium}</div>
                </div>
                <div className="glass rounded-xl p-4 border-l-4 border-blue-500">
                    <div className="text-white/40 text-sm">🔵 Low</div>
                    <div className="text-2xl font-bold text-white mt-1">{stats.low}</div>
                </div>
                <div className="glass rounded-xl p-4 border-l-4 border-purple-500">
                    <div className="text-white/40 text-sm">📊 Total 24h</div>
                    <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
                </div>
            </div>

            {/* Agent Health Overview */}
            <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Santé des Agents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {agents.map(agent => (
                        <AgentHealthCard key={agent.id} agentId={agent.id} name={agent.name} color={agent.color} />
                    ))}
                </div>
            </div>

            {/* Client Component pour les alertes interactives */}
            <SupervisorClient agents={agents} />
        </div>
    );
}

async function AgentHealthCard({ agentId, name, color }: { agentId: string; name: string; color: string }) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [alertCount, criticalCount] = await Promise.all([
        prisma.supervisorAlert.count({
            where: {
                agentId,
                createdAt: { gte: last24h }
            }
        }),
        prisma.supervisorAlert.count({
            where: {
                agentId,
                severity: "CRITICAL",
                status: "NEW"
            }
        })
    ]);

    const health = criticalCount > 0 ? "CRITICAL" : alertCount > 5 ? "WARNING" : "HEALTHY";
    const healthColors = {
        HEALTHY: "bg-green-500/20 border-green-500/50 text-green-400",
        WARNING: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
        CRITICAL: "bg-red-500/20 border-red-500/50 text-red-400"
    };

    return (
        <div className={`p-4 rounded-lg border ${healthColors[health]}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-medium">{name}</span>
            </div>
            <div className="text-2xl font-bold">{alertCount}</div>
            <div className="text-sm opacity-70">
                {criticalCount > 0 ? `${criticalCount} critical` : "Aucun problème"}
            </div>
        </div>
    );
}
