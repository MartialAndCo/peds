/**
 * GET /api/contacts/[id]/intelligence
 * Récupère le profil intelligent complet d'un contact
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getConfidenceLabel } from '@/lib/profile-intelligence'

export const dynamic = 'force-dynamic'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const { searchParams } = new URL(req.url)
        const includeRaw = searchParams.get('includeRaw') === 'true'

        // Récupérer le contact
        const contact = await prisma.contact.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                phone_whatsapp: true,
                discordId: true,
                source: true,
                status: true,
                agentPhase: true,
                createdAt: true
            }
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        // Récupérer le profil intelligent
        const profile = await prisma.contactProfile.findUnique({
            where: { contactId: id },
            include: {
                attributes: {
                    where: { isDeleted: false },
                    orderBy: [{ confidence: 'desc' }, { extractedAt: 'desc' }],
                    take: includeRaw ? 100 : 0 // Uniquement si includeRaw=true
                },
                relationships: {
                    orderBy: { extractedAt: 'desc' },
                    take: 20
                },
                events: {
                    orderBy: [{ importance: 'desc' }, { extractedAt: 'desc' }],
                    take: 20
                },
                interests: {
                    orderBy: { extractedAt: 'desc' },
                    take: 20
                },
                psychology: true,
                financial: true,
                extractionLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                },
                _count: {
                    select: {
                        attributes: true,
                        relationships: true,
                        events: true,
                        interests: true,
                        extractionLogs: true
                    }
                }
            }
        })

        if (!profile) {
            return NextResponse.json({
                contact,
                profile: null,
                hasProfile: false,
                message: 'No intelligence profile found. Run extraction first.'
            })
        }

        // Calculer les stats
        const confidenceLabel = getConfidenceLabel(profile.confidence)
        
        // Grouper les attributs par catégorie (pour la UI)
        const attributesByCategory = includeRaw 
            ? groupByCategory(profile.attributes)
            : {}

        // Détecter les alertes importantes
        const alerts = detectAlerts(profile)

        return NextResponse.json({
            contact,
            profile: {
                ...profile,
                confidenceLabel,
                attributesByCategory,
                alerts,
                stats: {
                    totalAttributes: profile._count.attributes,
                    totalRelationships: profile._count.relationships,
                    totalEvents: profile._count.events,
                    totalInterests: profile._count.interests,
                    extractionCount: profile._count.extractionLogs
                }
            },
            hasProfile: true
        })

    } catch (error: any) {
        console.error('[API] Intelligence fetch failed:', error)
        return NextResponse.json(
            { error: 'Internal error', message: error.message },
            { status: 500 }
        )
    }
}

function groupByCategory(attributes: any[]) {
    const groups: Record<string, any[]> = {}
    
    for (const attr of attributes) {
        if (!groups[attr.category]) {
            groups[attr.category] = []
        }
        groups[attr.category].push(attr)
    }
    
    return groups
}

function detectAlerts(profile: any): Array<{
    type: 'warning' | 'critical' | 'info' | 'opportunity'
    title: string
    description: string
    source?: string
}> {
    const alerts: Array<any> = []
    
    // Alerte âge
    const ageAttr = profile.attributes?.find((a: any) => a.key === 'age')
    if (ageAttr && parseInt(ageAttr.value) < 18) {
        alerts.push({
            type: 'critical',
            title: 'Mineur potentiel',
            description: `Âge déclaré: ${ageAttr.value} ans`,
            source: ageAttr.context
        })
    }
    
    // Alerte vulnérabilité financière
    if (profile.financial?.isFinanciallyVulnerable) {
        alerts.push({
            type: 'opportunity',
            title: 'Vulnérabilité financière détectée',
            description: profile.financial.vulnerabilityContext || 'Besoins financiers urgents identifiés',
            source: 'Analyse financière'
        })
    }
    
    // Alerte dettes
    if (profile.financial?.hasDebts && profile.financial?.debtAmount) {
        alerts.push({
            type: 'opportunity',
            title: 'Dette identifiée',
            description: profile.financial.debtAmount,
            source: 'Extraction financière'
        })
    }
    
    // Alerte état émotionnel critique
    if (profile.psychology?.emotionalState === 'depressed' || 
        profile.psychology?.emotionalState === 'suicidal') {
        alerts.push({
            type: 'critical',
            title: 'État émotionnel préoccupant',
            description: `État détecté: ${profile.psychology.emotionalState}`,
            source: 'Analyse psychologique'
        })
    }
    
    // Alerte red flags
    if (profile.psychology?.redFlags?.length > 0) {
        alerts.push({
            type: 'warning',
            title: 'Red flags comportementaux',
            description: profile.psychology.redFlags.join(', '),
            source: 'Analyse comportementale'
        })
    }
    
    // Info vulnérabilités pour escalation
    if (profile.psychology?.vulnerabilities?.length > 0) {
        alerts.push({
            type: 'info',
            title: 'Vulnérabilités exploitables',
            description: profile.psychology.vulnerabilities.join(', '),
            source: 'Analyse psychologique'
        })
    }
    
    return alerts
}
