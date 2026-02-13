'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
    Brain, AlertTriangle, CheckCircle, Frown, Smile,
    MessageCircle, Zap, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfilePsychologyProps {
    profile: any
}

export function ProfilePsychology({ profile }: ProfilePsychologyProps) {
    const { psychology } = profile
    
    if (!psychology) {
        return (
            <div className="text-center py-12 text-white/40">
                Aucune analyse psychologique disponible
            </div>
        )
    }
    
    const traits = [
        { key: 'openness', label: 'Ouverture', value: psychology.traits?.openness },
        { key: 'conscientiousness', label: 'Conscienciosité', value: psychology.traits?.conscientiousness },
        { key: 'extraversion', label: 'Extraversion', value: psychology.traits?.extraversion },
        { key: 'agreeableness', label: 'Agréabilité', value: psychology.traits?.agreeableness },
        { key: 'neuroticism', label: 'Névrosisme', value: psychology.traits?.neuroticism, isReverse: true }
    ]
    
    return (
        <div className="space-y-6">
            {/* Big Five Traits */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        BIG FIVE (Traits de Personnalité)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {traits.map((trait) => (
                        <TraitBar 
                            key={trait.key}
                            label={trait.label}
                            value={trait.value}
                            isReverse={trait.isReverse}
                        />
                    ))}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Communication Style */}
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <MessageCircle className="h-4 w-4" />
                            STYLE DE COMMUNICATION
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <CommunicationRow 
                            label="Style"
                            value={psychology.communication?.style}
                            options={{
                                direct: { color: 'bg-blue-500', label: 'Direct' },
                                passive: { color: 'bg-amber-500', label: 'Passif' },
                                aggressive: { color: 'bg-red-500', label: 'Agressif' },
                                manipulative: { color: 'bg-purple-500', label: 'Manipulateur' },
                                passive_aggressive: { color: 'bg-orange-500', label: 'Passif-agressif' }
                            }}
                        />
                        <CommunicationRow 
                            label="Vitesse de réponse"
                            value={psychology.communication?.responseSpeed}
                            options={{
                                fast: { color: 'bg-emerald-500', label: 'Rapide' },
                                normal: { color: 'bg-blue-500', label: 'Normale' },
                                slow: { color: 'bg-amber-500', label: 'Lente' },
                                erratic: { color: 'bg-red-500', label: 'Erratique' }
                            }}
                        />
                        <CommunicationRow 
                            label="Verbosité"
                            value={psychology.communication?.verbosity}
                            options={{
                                concise: { color: 'bg-blue-500', label: 'Concis' },
                                normal: { color: 'bg-emerald-500', label: 'Normal' },
                                verbose: { color: 'bg-amber-500', label: 'Bavard' }
                            }}
                        />
                    </CardContent>
                </Card>

                {/* État Émotionnel */}
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <Frown className="h-4 w-4" />
                            ÉTAT ÉMOTIONNEL
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {psychology.emotionalState ? (
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-3 rounded-lg",
                                    getEmotionColor(psychology.emotionalState)
                                )}>
                                    {getEmotionIcon(psychology.emotionalState)}
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-white capitalize">
                                        {psychology.emotionalState.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-sm text-white/50">
                                        État actuel détecté
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-white/40 italic">Non détecté</p>
                        )}
                        
                        {psychology.stressors?.length > 0 && (
                            <div>
                                <p className="text-sm text-white/60 mb-2">Sources de stress:</p>
                                <div className="flex flex-wrap gap-2">
                                    {psychology.stressors.map((stressor: string, idx: number) => (
                                        <Badge key={idx} variant="destructive" className="text-xs">
                                            {stressor}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Red Flags */}
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            RED FLAGS
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {psychology.redFlags?.length > 0 ? (
                            <div className="space-y-2">
                                {psychology.redFlags.map((flag: string, idx: number) => (
                                    <div 
                                        key={idx}
                                        className="flex items-center gap-2 p-2 bg-red-500/10 rounded border border-red-500/20"
                                    >
                                        <AlertTriangle className="h-4 w-4 text-red-400" />
                                        <span className="text-sm text-red-200 capitalize">
                                            {flag.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-white/40 italic">Aucun red flag détecté</p>
                        )}
                    </CardContent>
                </Card>

                {/* Green Flags */}
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            GREEN FLAGS
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {psychology.greenFlags?.length > 0 ? (
                            <div className="space-y-2">
                                {psychology.greenFlags.map((flag: string, idx: number) => (
                                    <div 
                                        key={idx}
                                        className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded border border-emerald-500/20"
                                    >
                                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                                        <span className="text-sm text-emerald-200 capitalize">
                                            {flag.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-white/40 italic">Aucun green flag détecté</p>
                        )}
                    </CardContent>
                </Card>

                {/* Vulnérabilités */}
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            VULNÉRABILITÉS
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {psychology.vulnerabilities?.length > 0 ? (
                            <div className="space-y-2">
                                {psychology.vulnerabilities.map((vuln: string, idx: number) => (
                                    <div 
                                        key={idx}
                                        className="flex items-center gap-2 p-2 bg-amber-500/10 rounded border border-amber-500/20"
                                    >
                                        <Zap className="h-4 w-4 text-amber-400" />
                                        <span className="text-sm text-amber-200 capitalize">
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
            </div>
        </div>
    )
}

function TraitBar({ label, value, isReverse = false }: { 
    label: string
    value?: number
    isReverse?: boolean
}) {
    if (value === undefined || value === null) {
        return (
            <div className="space-y-1">
                <div className="flex justify-between text-sm">
                    <span className="text-white/40">{label}</span>
                    <span className="text-white/20">Inconnu</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full" />
            </div>
        )
    }
    
    const percentage = (value / 10) * 100
    const color = isReverse 
        ? value > 7 ? 'bg-red-500' : value > 4 ? 'bg-amber-500' : 'bg-emerald-500'
        : value > 7 ? 'bg-emerald-500' : value > 4 ? 'bg-blue-500' : 'bg-amber-500'
    
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="text-white/60">{label}</span>
                <span className="text-white font-medium">{value}/10</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    )
}

function CommunicationRow({ 
    label, 
    value, 
    options 
}: { 
    label: string
    value?: string
    options: Record<string, { color: string; label: string }>
}) {
    if (!value) {
        return (
            <div className="flex justify-between items-center py-2">
                <span className="text-sm text-white/40">{label}</span>
                <span className="text-sm text-white/20">Inconnu</span>
            </div>
        )
    }
    
    const option = options[value]
    
    return (
        <div className="flex justify-between items-center py-2">
            <span className="text-sm text-white/60">{label}</span>
            <Badge className={option?.color || 'bg-gray-500'}>
                {option?.label || value}
            </Badge>
        </div>
    )
}

function getEmotionColor(emotion: string): string {
    const colors: Record<string, string> = {
        stressed: 'bg-red-500/20 text-red-400',
        anxious: 'bg-amber-500/20 text-amber-400',
        depressed: 'bg-purple-500/20 text-purple-400',
        happy: 'bg-emerald-500/20 text-emerald-400',
        excited: 'bg-blue-500/20 text-blue-400',
        angry: 'bg-red-600/20 text-red-500',
        bored: 'bg-gray-500/20 text-gray-400',
        lonely: 'bg-indigo-500/20 text-indigo-400'
    }
    return colors[emotion] || 'bg-blue-500/20 text-blue-400'
}

function getEmotionIcon(emotion: string) {
    // Simple smiley based on emotion
    const isNegative = ['stressed', 'anxious', 'depressed', 'angry', 'sad', 'lonely'].includes(emotion)
    const isPositive = ['happy', 'excited', 'joyful', 'content'].includes(emotion)
    
    if (isNegative) return <Frown className="h-6 w-6" />
    if (isPositive) return <Smile className="h-6 w-6" />
    return <Brain className="h-6 w-6" />
}
