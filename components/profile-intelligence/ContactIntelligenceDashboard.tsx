'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { 
    User, Brain, Wallet, Activity, Clock, AlertTriangle,
    RefreshCw, ChevronLeft, Sparkles, Shield, Target
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

import { ProfileSummary } from './ProfileSummary'
import { ProfileIdentity } from './ProfileIdentity'
import { ProfilePsychology } from './ProfilePsychology'
import { ProfileFinancial } from './ProfileFinancial'

interface ContactIntelligenceDashboardProps {
    contactId: string
    agentId?: string
    onBack?: () => void
}

export function ContactIntelligenceDashboard({ 
    contactId, 
    agentId,
    onBack 
}: ContactIntelligenceDashboardProps) {
    const { toast } = useToast()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [extracting, setExtracting] = useState(false)
    const [activeTab, setActiveTab] = useState('summary')

    useEffect(() => {
        loadProfile()
    }, [contactId])

    const loadProfile = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`/api/contacts/${contactId}/intelligence`)
            setProfile(normalizeProfileForUI(res.data.profile))
        } catch (err) {
            console.error('Failed to load profile:', err)
            setProfile(null)
        } finally {
            setLoading(false)
        }
    }

    const handleExtract = async () => {
        try {
            setExtracting(true)
            await axios.post(`/api/contacts/${contactId}/intelligence/extract`, {
                agentId,
                messageCount: 50
            })
            await loadProfile()
        } catch (err: any) {
            console.error('Extraction failed:', err)
            const message = err?.response?.data?.error || err?.response?.data?.message || 'Extraction impossible'
            toast({
                title: 'Extraction échouée',
                description: message,
                variant: 'destructive'
            })
        } finally {
            setExtracting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <div className="p-4 bg-white/5 rounded-full">
                    <Sparkles className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Aucun profil intelligent</h3>
                <p className="text-sm text-white/50 text-center max-w-md">
                    Ce contact n'a pas encore été analysé. Lancez une extraction pour créer son fichier de renseignement.
                </p>
                <Button 
                    onClick={handleExtract}
                    disabled={extracting}
                    className="bg-blue-600 hover:bg-blue-500"
                >
                    {extracting ? (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Analyse en cours...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Extraire le profil
                        </>
                    )}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <Button variant="ghost" size="icon" onClick={onBack}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            Fichier de Renseignement
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge 
                                variant="outline" 
                                style={{ borderColor: profile.confidenceLabel?.color || '#94a3b8', color: profile.confidenceLabel?.color || '#94a3b8' }}
                            >
                                Confiance: {profile.confidence}/100 - {profile.confidenceLabel?.label || 'N/A'}
                            </Badge>
                            <span className="text-xs text-white/40">
                                {profile._count.attributes} attributs • {profile._count.relationships} relations
                            </span>
                        </div>
                    </div>
                </div>
                
                <Button 
                    variant="outline" 
                    onClick={handleExtract}
                    disabled={extracting}
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", extracting && "animate-spin")} />
                    {extracting ? 'Analyse...' : 'Mettre à jour'}
                </Button>
            </div>

            {/* Alertes */}
            {profile.alerts?.length > 0 && (
                <div className="space-y-2">
                    {profile.alerts.map((alert: any, idx: number) => (
                        <div 
                            key={idx}
                            className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border",
                                alert.type === 'critical' && "bg-red-500/10 border-red-500/30",
                                alert.type === 'warning' && "bg-amber-500/10 border-amber-500/30",
                                alert.type === 'opportunity' && "bg-emerald-500/10 border-emerald-500/30",
                                alert.type === 'info' && "bg-blue-500/10 border-blue-500/30"
                            )}
                        >
                            <AlertTriangle className={cn(
                                "h-5 w-5 shrink-0",
                                alert.type === 'critical' && "text-red-400",
                                alert.type === 'warning' && "text-amber-400",
                                alert.type === 'opportunity' && "text-emerald-400",
                                alert.type === 'info' && "text-blue-400"
                            )} />
                            <div>
                                <p className={cn(
                                    "text-sm font-medium",
                                    alert.type === 'critical' && "text-red-300",
                                    alert.type === 'warning' && "text-amber-300",
                                    alert.type === 'opportunity' && "text-emerald-300",
                                    alert.type === 'info' && "text-blue-300"
                                )}>
                                    {alert.title}
                                </p>
                                <p className="text-xs text-white/60 mt-0.5">{alert.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="summary" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Synthèse
                    </TabsTrigger>
                    <TabsTrigger value="identity" className="gap-2">
                        <User className="h-4 w-4" />
                        Identité
                    </TabsTrigger>
                    <TabsTrigger value="psychology" className="gap-2">
                        <Brain className="h-4 w-4" />
                        Psychologie
                    </TabsTrigger>
                    <TabsTrigger value="financial" className="gap-2">
                        <Wallet className="h-4 w-4" />
                        Financier
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Historique
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-6">
                    <ProfileSummary profile={profile} />
                </TabsContent>

                <TabsContent value="identity" className="mt-6">
                    <ProfileIdentity profile={profile} />
                </TabsContent>

                <TabsContent value="psychology" className="mt-6">
                    <ProfilePsychology profile={profile} />
                </TabsContent>

                <TabsContent value="financial" className="mt-6">
                    <ProfileFinancial profile={profile} />
                </TabsContent>

                <TabsContent value="timeline" className="mt-6">
                    <ProfileTimeline logs={profile.extractionLogs} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function normalizeProfileForUI(profile: any) {
    if (!profile) return null

    const identity = profile.identity || {
        displayName: profile.displayName,
        realName: profile.realName,
        aliases: profile.aliases || [],
        gender: profile.gender,
        birthDate: profile.birthDate,
        city: profile.city,
        country: profile.country,
        timezone: profile.timezone,
        maritalStatus: profile.maritalStatus,
        livingWith: profile.livingWith,
        occupation: profile.occupation,
        workplace: profile.workplace,
        incomeLevel: profile.incomeLevel,
        schedule: profile.schedule,
        platforms: profile.platforms || [],
        usernames: profile.usernames || {}
    }

    return {
        ...profile,
        identity,
        confidenceLabel: profile.confidenceLabel || {
            label: 'Inconnu',
            color: '#94a3b8',
            description: ''
        },
        alerts: Array.isArray(profile.alerts) ? profile.alerts : [],
        extractionLogs: Array.isArray(profile.extractionLogs) ? profile.extractionLogs : [],
        _count: profile._count || {
            attributes: 0,
            relationships: 0,
            events: 0,
            interests: 0,
            extractionLogs: 0
        },
        stats: profile.stats || {
            totalAttributes: profile._count?.attributes || 0,
            totalRelationships: profile._count?.relationships || 0,
            totalEvents: profile._count?.events || 0,
            totalInterests: profile._count?.interests || 0,
            extractionCount: profile._count?.extractionLogs || 0
        }
    }
}

function ProfileTimeline({ logs }: { logs: any[] }) {
    if (!logs?.length) {
        return (
            <div className="text-center py-12 text-white/40">
                Aucun historique d'extraction
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                    <div className="p-2 bg-blue-500/10 rounded">
                        <Clock className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-white">
                                Extraction {log.triggeredBy === 'manual' ? 'manuelle' : 'auto'}
                            </p>
                            <span className="text-xs text-white/40">
                                {new Date(log.createdAt).toLocaleString()}
                            </span>
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                            {log.attributesFound} attributs • {log.relationshipsFound} relations • {log.eventsFound} événements
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                            {log.processingTimeMs}ms
                        </p>
                    </div>
                </div>
            ))}
        </div>
    )
}
