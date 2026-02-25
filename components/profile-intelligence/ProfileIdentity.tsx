'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
    User, MapPin, Briefcase, Heart, Globe, Calendar,
    Smartphone, Mail, Link as LinkIcon
} from 'lucide-react'

interface ProfileIdentityProps {
    profile: any
}

export function ProfileIdentity({ profile }: ProfileIdentityProps) {
    const identity = profile?.identity || {}
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Identité de Base */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        IDENTITÉ
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <IdentityRow 
                        label="Nom d'affichage"
                        value={identity.displayName}
                        icon={User}
                    />
                    <IdentityRow 
                        label="Nom réel"
                        value={identity.realName}
                        icon={User}
                    />
                    <IdentityRow 
                        label="Surnoms"
                        value={identity.aliases?.join(', ')}
                        icon={Heart}
                        isArray
                    />
                    <IdentityRow 
                        label="Genre"
                        value={identity.gender}
                        icon={User}
                    />
                    <IdentityRow 
                        label="Date de naissance"
                        value={identity.birthDate}
                        icon={Calendar}
                    />
                </CardContent>
            </Card>

            {/* Localisation */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        LOCALISATION
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <IdentityRow 
                        label="Ville"
                        value={identity.city}
                        icon={MapPin}
                    />
                    <IdentityRow 
                        label="Pays"
                        value={identity.country}
                        icon={Globe}
                    />
                    <IdentityRow 
                        label="Fuseau horaire"
                        value={identity.timezone}
                        icon={Clock}
                    />
                </CardContent>
            </Card>

            {/* Situation */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <Heart className="h-4 w-4" />
                        SITUATION
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <IdentityRow 
                        label="Statut marital"
                        value={identity.maritalStatus}
                        icon={Heart}
                    />
                    <IdentityRow 
                        label="Vit avec"
                        value={identity.livingWith}
                        icon={Home}
                    />
                </CardContent>
            </Card>

            {/* Profession */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        PROFESSION
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <IdentityRow 
                        label="Occupation"
                        value={identity.occupation}
                        icon={Briefcase}
                    />
                    <IdentityRow 
                        label="Lieu de travail/études"
                        value={identity.workplace}
                        icon={Building}
                    />
                    <IdentityRow 
                        label="Niveau de revenus"
                        value={identity.incomeLevel}
                        icon={DollarSign}
                    />
                    <IdentityRow 
                        label="Horaires"
                        value={identity.schedule}
                        icon={Clock}
                    />
                </CardContent>
            </Card>

            {/* Online Presence */}
            <Card className="bg-white/5 border-white/10 lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        PRÉSENCE EN LIGNE
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {identity.platforms?.map((platform: string, idx: number) => (
                            <Badge key={idx} variant="secondary">
                                {platform}
                            </Badge>
                        ))}
                    </div>
                    
                    {identity.usernames && Object.keys(identity.usernames).length > 0 && (
                        <div className="space-y-2">
                            {Object.entries(identity.usernames).map(([platform, username]: [string, any]) => (
                                <div key={platform} className="flex items-center justify-between p-2 bg-white/5 rounded">
                                    <span className="text-sm text-white/60 capitalize">{platform}</span>
                                    <span className="text-sm font-mono text-white">{username}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// Icon placeholders
function Clock({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

function Home({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    )
}

function Building({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M12 10h.01" />
            <path d="M12 14h.01" />
            <path d="M16 10h.01" />
            <path d="M16 14h.01" />
            <path d="M8 10h.01" />
            <path d="M8 14h.01" />
        </svg>
    )
}

function DollarSign({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    )
}

function IdentityRow({ 
    label, 
    value, 
    icon: Icon,
    isArray = false
}: { 
    label: string
    value: string | string[] | null | undefined
    icon: any
    isArray?: boolean
}) {
    const displayValue = isArray 
        ? (Array.isArray(value) && value.length > 0 ? value.join(', ') : value)
        : value
        
    if (!displayValue || (Array.isArray(displayValue) && displayValue.length === 0)) {
        return (
            <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2 text-white/40">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{label}</span>
                </div>
                <span className="text-sm text-white/20 italic">Inconnu</span>
            </div>
        )
    }
    
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2 text-white/60">
                <Icon className="h-4 w-4" />
                <span className="text-sm">{label}</span>
            </div>
            <span className="text-sm font-medium text-white">{displayValue}</span>
        </div>
    )
}
