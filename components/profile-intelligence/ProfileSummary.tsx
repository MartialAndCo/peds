'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
    User, MapPin, Briefcase, AlertCircle, Target,
    TrendingUp, Shield, Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileSummaryProps {
    profile: any
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
    const { psychology, financial, stats } = profile
    
    // Calculer le profil type
    const profileType = getProfileType(profile)
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Carte Profil Type */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        PROFIL TYPE
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <User className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-white">{profileType.title}</p>
                                <p className="text-sm text-white/50">{profileType.subtitle}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            {profileType.tags.map((tag: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="mr-2">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Carte Vulnérabilités */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        VULNÉRABILITÉS
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {psychology?.vulnerabilities?.length > 0 ? (
                        <div className="space-y-2">
                            {psychology.vulnerabilities.map((vuln: string, idx: number) => (
                                <div 
                                    key={idx}
                                    className="flex items-center gap-2 p-2 bg-red-500/10 rounded border border-red-500/20"
                                >
                                    <Zap className="h-4 w-4 text-red-400" />
                                    <span className="text-sm text-red-200 capitalize">
                                        {vuln.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/40 italic">Aucune vulnérabilité identifiée</p>
                    )}
                </CardContent>
            </Card>

            {/* Carte Opportunités */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        OPPORTUNITÉS
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {financial?.urgentNeeds?.length > 0 ? (
                        <div className="space-y-2">
                            {financial.urgentNeeds.slice(0, 3).map((need: string, idx: number) => (
                                <div 
                                    key={idx}
                                    className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded border border-emerald-500/20"
                                >
                                    <Target className="h-4 w-4 text-emerald-400" />
                                    <span className="text-sm text-emerald-200">{need}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/40 italic">Aucun besoin urgent identifié</p>
                    )}
                </CardContent>
            </Card>

            {/* Score de Confiance Détaillé */}
            <Card className="bg-white/5 border-white/10 lg:col-span-3">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        SCORE DE CONFIANCE
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="text-4xl font-bold" style={{ color: profile.confidenceLabel.color }}>
                            {Math.round(profile.confidence)}
                        </div>
                        <div>
                            <p className="text-lg font-medium text-white">{profile.confidenceLabel.label}</p>
                            <p className="text-sm text-white/50">{profile.confidenceLabel.description}</p>
                        </div>
                    </div>
                    
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full transition-all duration-1000 rounded-full"
                            style={{ 
                                width: `${profile.confidence}%`,
                                backgroundColor: profile.confidenceLabel.color 
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <Card className="bg-white/5 border-white/10 lg:col-span-3">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-4 gap-4">
                        <StatBox 
                            label="Attributs" 
                            value={stats.totalAttributes}
                            icon={Target}
                        />
                        <StatBox 
                            label="Relations" 
                            value={stats.totalRelationships}
                            icon={User}
                        />
                        <StatBox 
                            label="Événements" 
                            value={profile._count.events}
                            icon={MapPin}
                        />
                        <StatBox 
                            label="Intérêts" 
                            value={profile._count.interests}
                            icon={Briefcase}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function StatBox({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
    return (
        <div className="text-center p-4 bg-white/5 rounded-lg">
            <Icon className="h-5 w-5 mx-auto mb-2 text-white/40" />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
        </div>
    )
}

function getProfileType(profile: any): { title: string; subtitle: string; tags: string[] } {
    const { identity, psychology, financial } = profile
    
    // Détecter le type de profil
    if (financial?.isFinanciallyVulnerable && psychology?.vulnerabilities?.includes('lonely')) {
        return {
            title: 'Cible Prioritaire',
            subtitle: 'Vulnérabilités financières + émotionnelles',
            tags: ['Pression financière', 'Solitude', 'Réceptif']
        }
    }
    
    if (financial?.isFinanciallyVulnerable) {
        return {
            title: 'Opportunité Financière',
            subtitle: 'Besoins financiers urgents identifiés',
            tags: ['Urgent', 'Story-ready', 'Escalation possible']
        }
    }
    
    if (psychology?.vulnerabilities?.length > 0) {
        return {
            title: 'Profil Émotionnel',
            subtitle: 'Vulnérabilités psychologiques détectées',
            tags: ['Approche douce', 'Validation requise']
        }
    }
    
    if (profile.confidence > 70) {
        return {
            title: 'Profil Établi',
            subtitle: 'Informations complètes et fiables',
            tags: ['Confiance élevée', 'Prêt pour escalation']
        }
    }
    
    return {
        title: 'Profil en Construction',
        subtitle: 'Besoin de plus d\'interactions',
        tags: ['Nouveau', 'À développer']
    }
}
