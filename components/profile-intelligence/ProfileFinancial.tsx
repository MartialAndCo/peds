'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
    Wallet, AlertCircle, CheckCircle, XCircle, TrendingDown,
    CreditCard, DollarSign, PiggyBank
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileFinancialProps {
    profile: any
}

export function ProfileFinancial({ profile }: ProfileFinancialProps) {
    const { financial } = profile
    
    if (!financial) {
        return (
            <div className="text-center py-12 text-white/40">
                Aucune analyse financière disponible
            </div>
        )
    }
    
    return (
        <div className="space-y-6">
            {/* Alertes financières */}
            {financial.isFinanciallyVulnerable && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-300">
                            Vulnérabilité financière détectée
                        </p>
                        <p className="text-sm text-white/60 mt-1">
                            {financial.vulnerabilityContext || 'Ce contact présente des signes de pression financière.'}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Situation Générale */}
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            SITUATION GÉNÉRALE
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                            <span className="text-sm text-white/60">Situation</span>
                            <SituationBadge situation={financial.situation} />
                        </div>
                        
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                            <span className="text-sm text-white/60">Type d'occupation</span>
                            <span className="text-sm text-white capitalize">
                                {financial.occupationType?.replace(/_/g, ' ') || 'Inconnu'}
                            </span>
                        </div>
                        
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                            <span className="text-sm text-white/60">Capacité de paiement</span>
                            <CapacityBadge capacity={financial.paymentCapacity} />
                        </div>
                    </CardContent>
                </Card>

                {/* Dettes */}
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" />
                            DETTES & PROBLÈMES
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                            <span className="text-sm text-white/60">A des dettes</span>
                            {financial.hasDebts === true ? (
                                <Badge variant="destructive">Oui</Badge>
                            ) : financial.hasDebts === false ? (
                                <Badge variant="default">Non</Badge>
                            ) : (
                                <span className="text-sm text-white/40">Inconnu</span>
                            )}
                        </div>
                        
                        {financial.debtAmount && (
                            <div className="p-3 bg-red-500/10 rounded border border-red-500/20">
                                <p className="text-xs text-white/50 mb-1">Montant / Détails</p>
                                <p className="text-lg font-semibold text-red-300">
                                    {financial.debtAmount}
                                </p>
                            </div>
                        )}
                        
                        {financial.urgentNeeds?.length > 0 && (
                            <div>
                                <p className="text-sm text-white/60 mb-2">Besoins urgents:</p>
                                <div className="space-y-2">
                                    {financial.urgentNeeds.map((need: string, idx: number) => (
                                        <div 
                                            key={idx}
                                            className="flex items-center gap-2 p-2 bg-amber-500/10 rounded"
                                        >
                                            <AlertCircle className="h-4 w-4 text-amber-400" />
                                            <span className="text-sm text-amber-200">{need}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Méthodes de Paiement */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        MÉTHODES DE PAIEMENT DISPONIBLES
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <PaymentMethod 
                            name="PayPal"
                            available={financial.hasPayPal}
                            icon={<DollarSign className="h-5 w-5" />}
                        />
                        <PaymentMethod 
                            name="CashApp"
                            available={financial.hasCashApp}
                            icon={<DollarSign className="h-5 w-5" />}
                        />
                        <PaymentMethod 
                            name="Venmo"
                            available={financial.hasVenmo}
                            icon={<DollarSign className="h-5 w-5" />}
                        />
                        <PaymentMethod 
                            name="Virement"
                            available={financial.hasBankTransfer}
                            icon={<PiggyBank className="h-5 w-5" />}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Historique de Paiement (vers nous) */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        HISTORIQUE DE PAIEMENT (VERS NOUS)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-white/5 rounded">
                            <p className="text-2xl font-bold text-white">
                                {financial.paymentCount || 0}
                            </p>
                            <p className="text-xs text-white/40 uppercase">Paiements reçus</p>
                        </div>
                        <div className="text-center p-4 bg-white/5 rounded">
                            <p className="text-2xl font-bold text-emerald-400">
                                ${financial.totalPaid?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-white/40 uppercase">Total reçu</p>
                        </div>
                        <div className="text-center p-4 bg-white/5 rounded">
                            <p className="text-2xl font-bold text-white">
                                {financial.maxHistoricalPayment ? `$${financial.maxHistoricalPayment.toFixed(2)}` : '-'}
                            </p>
                            <p className="text-xs text-white/40 uppercase">Plus gros paiement</p>
                        </div>
                    </div>
                    
                    {financial.lastPaymentAt && (
                        <p className="text-sm text-white/50 mt-4 text-center">
                            Dernier paiement: {new Date(financial.lastPaymentAt).toLocaleDateString()}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function SituationBadge({ situation }: { situation?: string }) {
    if (!situation) return <span className="text-sm text-white/40">Inconnu</span>
    
    const config: Record<string, { color: string; label: string }> = {
        stable: { color: 'bg-emerald-500', label: 'Stable' },
        precarious: { color: 'bg-amber-500', label: 'Précaire' },
        wealthy: { color: 'bg-blue-500', label: 'Aisé' },
        struggling: { color: 'bg-red-500', label: 'En difficulté' },
        unknown: { color: 'bg-gray-500', label: 'Inconnu' }
    }
    
    const { color, label } = config[situation] || config.unknown
    
    return <Badge className={color}>{label}</Badge>
}

function CapacityBadge({ capacity }: { capacity?: string }) {
    if (!capacity) return <span className="text-sm text-white/40">Inconnu</span>
    
    const config: Record<string, { color: string; label: string; icon: any }> = {
        none: { color: 'bg-red-500', label: 'Aucune', icon: XCircle },
        low: { color: 'bg-amber-500', label: 'Faible', icon: TrendingDown },
        medium: { color: 'bg-blue-500', label: 'Moyenne', icon: DollarSign },
        high: { color: 'bg-emerald-500', label: 'Élevée', icon: CheckCircle }
    }
    
    const { color, label } = config[capacity] || config.none
    
    return <Badge className={color}>{label}</Badge>
}

function PaymentMethod({ 
    name, 
    available, 
    icon 
}: { 
    name: string
    available?: boolean
    icon: React.ReactNode
}) {
    return (
        <div className={cn(
            "flex flex-col items-center p-4 rounded-lg border",
            available === true ? "bg-emerald-500/10 border-emerald-500/30" :
            available === false ? "bg-red-500/10 border-red-500/30" :
            "bg-white/5 border-white/10"
        )}>
            <div className={cn(
                "mb-2",
                available === true ? "text-emerald-400" :
                available === false ? "text-red-400" :
                "text-white/40"
            )}>
                {icon}
            </div>
            <span className={cn(
                "text-sm font-medium",
                available === true ? "text-emerald-300" :
                available === false ? "text-red-300" :
                "text-white/60"
            )}>
                {name}
            </span>
            {available === true ? (
                <CheckCircle className="h-4 w-4 text-emerald-400 mt-1" />
            ) : available === false ? (
                <XCircle className="h-4 w-4 text-red-400 mt-1" />
            ) : (
                <span className="text-xs text-white/30 mt-1">?</span>
            )}
        </div>
    )
}
