"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Check, X, Eye, RefreshCw } from "lucide-react";
import { getContactDisplayName } from "@/lib/contact-display";

interface Alert {
    id: string;
    agentId: string;
    conversationId: number;
    contactId?: string;
    agentType: string;
    alertType: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    evidence: Record<string, any>;
    status: "NEW" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE";
    autoPaused: boolean;
    createdAt: string;
    conversation?: { id: number; status: string };
    contact?: { id: string; name: string | null; phone_whatsapp: string };
}

interface Agent {
    id: string;
    name: string;
    color: string;
}

export function SupervisorClient({ agents }: { agents: Agent[] }) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "NEW" | "INVESTIGATING">("NEW");

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== "ALL") params.append("severity", filter);
            if (statusFilter !== "ALL") params.append("status", statusFilter);

            const res = await fetch(`/api/supervisor?${params}`);
            const data = await res.json();
            setAlerts(data.alerts || []);
        } catch (error) {
            console.error("Failed to fetch alerts:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [filter, statusFilter]);

    const updateAlertStatus = async (alertId: string, status: string) => {
        try {
            await fetch("/api/supervisor", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertId, status }),
            });
            fetchAlerts();
        } catch (error) {
            console.error("Failed to update alert:", error);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return "bg-red-500/20 border-red-500 text-red-400";
            case "HIGH": return "bg-orange-500/20 border-orange-500 text-orange-400";
            case "MEDIUM": return "bg-yellow-500/20 border-yellow-500 text-yellow-400";
            case "LOW": return "bg-blue-500/20 border-blue-500 text-blue-400";
            default: return "bg-gray-500/20 border-gray-500 text-gray-400";
        }
    };

    const getAgentName = (agentId: string) => {
        return agents.find(a => a.id === agentId)?.name || agentId;
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="glass rounded-xl p-4 flex flex-wrap gap-4 items-center">
                <div className="flex gap-2">
                    {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(sev => (
                        <button
                            key={sev}
                            onClick={() => setFilter(sev)}
                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${filter === sev
                                ? "bg-white/20 text-white"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                                }`}
                        >
                            {sev === "ALL" ? "Tous" : sev}
                        </button>
                    ))}
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="flex gap-2">
                    {(["NEW", "INVESTIGATING", "ALL"] as const).map(st => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${statusFilter === st
                                ? "bg-white/20 text-white"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                                }`}
                        >
                            {st === "ALL" ? "Tous statuts" : st === "NEW" ? "Nouveaux" : "En cours"}
                        </button>
                    ))}
                </div>
                <button
                    onClick={fetchAlerts}
                    className="ml-auto p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
                </button>
                <div className="h-6 w-px bg-white/10 mx-2" />
                <button
                    onClick={async () => {
                        if (!confirm("Attention: Cette action supprimera TOUTES les alertes de la base de données. Continuer ?")) return;
                        try {
                            setLoading(true);
                            await fetch("/api/supervisor", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "flush" }),
                            });
                            await fetchAlerts();
                        } catch (error) {
                            console.error("Flush failed:", error);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    title="Supprimer toutes les alertes (Flush)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                </button>
            </div>

            {/* Alerts List */}
            {loading ? (
                <div className="glass rounded-xl p-12 text-center">
                    <RefreshCw className="w-8 h-8 text-white/40 animate-spin mx-auto mb-4" />
                    <p className="text-white/40">Chargement des alertes...</p>
                </div>
            ) : alerts.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                    <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-white/60 text-lg">Aucune alerte trouvée</p>
                    <p className="text-white/40 text-sm mt-2">Tous les agents fonctionnent correctement</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map(alert => (
                        <AlertCard
                            key={alert.id}
                            alert={alert}
                            agentName={getAgentName(alert.agentId)}
                            onUpdateStatus={updateAlertStatus}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function AlertCard({
    alert,
    agentName,
    onUpdateStatus
}: {
    alert: Alert;
    agentName: string;
    onUpdateStatus: (id: string, status: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const contactName = alert.contact
        ? getContactDisplayName(alert.contact, alert.contact.phone_whatsapp || '-')
        : '';

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return "border-red-500 bg-red-500/10";
            case "HIGH": return "border-orange-500 bg-orange-500/10";
            case "MEDIUM": return "border-yellow-500 bg-yellow-500/10";
            case "LOW": return "border-blue-500 bg-blue-500/10";
            default: return "border-gray-500 bg-gray-500/10";
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return "bg-red-500 text-white";
            case "HIGH": return "bg-orange-500 text-white";
            case "MEDIUM": return "bg-yellow-500 text-black";
            case "LOW": return "bg-blue-500 text-white";
            default: return "bg-gray-500 text-white";
        }
    };

    return (
        <div className={`glass rounded-xl border-l-4 ${getSeverityColor(alert.severity)} overflow-hidden`}>
            <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityBadge(alert.severity)}`}>
                                {alert.severity}
                            </span>
                            <span className="text-white/40 text-xs">{alert.agentType}</span>
                            <span className="text-white/40 text-xs">•</span>
                            <span className="text-white/40 text-xs">{agentName}</span>
                            {alert.autoPaused && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/50">
                                    AUTO-PAUSED
                                </span>
                            )}
                        </div>
                        <h3 className="text-white font-medium">{alert.title}</h3>
                        <p className="text-white/60 text-sm mt-1 line-clamp-2">{alert.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {alert.agentType === 'QUEUE' && (
                            <a
                                href="/admin/queue"
                                className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-xs transition-colors"
                                title="Voir la file d'attente"
                            >
                                Queue
                            </a>
                        )}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Eye className="w-4 h-4 text-white/60" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-4 text-xs text-white/40">
                        <span>{new Date(alert.createdAt).toLocaleString("fr-FR")}</span>
                        {alert.contact && (
                            <span>
                                {contactName}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {alert.status === "NEW" && (
                            <>
                                <button
                                    onClick={() => onUpdateStatus(alert.id, "INVESTIGATING")}
                                    className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs transition-colors"
                                >
                                    Investiguer
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(alert.id, "FALSE_POSITIVE")}
                                    className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs transition-colors"
                                >
                                    Faux positif
                                </button>
                            </>
                        )}
                        {alert.status === "INVESTIGATING" && (
                            <button
                                onClick={() => onUpdateStatus(alert.id, "RESOLVED")}
                                className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs transition-colors"
                            >
                                Résolu
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3">
                    <h4 className="text-white/60 text-xs uppercase tracking-wider mb-2">Evidence</h4>
                    <pre className="bg-black/30 rounded-lg p-3 text-xs text-white/70 overflow-auto max-h-60">
                        {JSON.stringify(alert.evidence, null, 2)}
                    </pre>
                    {alert.conversation && (
                        <div className="mt-3">
                            <a
                                href={`/admin/conversations/${alert.conversationId}`}
                                className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                                Voir la conversation →
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
