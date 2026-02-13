/**
 * GET /api/contacts/[id]/intelligence/summary
 * Retourne une synthèse rapide du profil pour le dashboard
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

        const profile = await prisma.contactProfile.findUnique({
            where: { contactId: id },
            include: {
                attributes: {
                    where: { isDeleted: false, confidence: { gte: 70 } },
                    orderBy: { confidence: 'desc' },
                    take: 10
                },
                psychology: {
                    select: {
                        emotionalState: true,
                        vulnerabilities: true,
                        redFlags: true
                    }
                },
                financial: {
                    select: {
                        situation: true,
                        hasDebts: true,
                        debtAmount: true,
                        urgentNeeds: true,
                        paymentCapacity: true,
                        isFinanciallyVulnerable: true
                    }
                },
                _count: {
                    select: {
                        attributes: true,
                        relationships: true
                    }
                }
            }
        })

        if (!profile) {
            return NextResponse.json({
                hasProfile: false,
                summary: null
            })
        }

        const confidenceLabel = getConfidenceLabel(profile.confidence)

        // Construire la synthèse
        const summary = {
            hasProfile: true,
            
            // Identité
            identity: {
                displayName: profile.displayName,
                realName: profile.realName,
                age: profile.aliases.find((a: string) => /^\d+$/.test(a)) || null,
                gender: profile.gender,
                location: profile.city && profile.country 
                    ? `${profile.city}, ${profile.country}`
                    : profile.city || profile.country || null,
                occupation: profile.occupation,
                workplace: profile.workplace
            },
            
            // Score
            confidence: {
                score: Math.round(profile.confidence),
                ...confidenceLabel
            },
            
            // État psychologique
            psychology: profile.psychology ? {
                emotionalState: profile.psychology.emotionalState,
                vulnerabilityCount: profile.psychology.vulnerabilities?.length || 0,
                hasRedFlags: (profile.psychology.redFlags?.length || 0) > 0
            } : null,
            
            // Situation financière
            financial: profile.financial ? {
                situation: profile.financial.situation,
                isVulnerable: profile.financial.isFinanciallyVulnerable,
                hasUrgentNeeds: (profile.financial.urgentNeeds?.length || 0) > 0,
                urgentNeeds: profile.financial.urgentNeeds?.slice(0, 3) || [],
                hasDebts: profile.financial.hasDebts,
                debtAmount: profile.financial.debtAmount,
                paymentCapacity: profile.financial.paymentCapacity
            } : null,
            
            // Attributs clés
            keyAttributes: profile.attributes.map(a => ({
                category: a.category,
                key: a.key,
                value: a.value,
                confidence: a.confidence
            })),
            
            // Stats
            stats: {
                totalAttributes: profile._count.attributes,
                totalRelationships: profile._count.relationships
            },
            
            // Recommandation
            recommendation: generateRecommendation(profile)
        }

        return NextResponse.json({ summary })

    } catch (error: any) {
        console.error('[API] Intelligence summary failed:', error)
        return NextResponse.json(
            { error: 'Internal error', message: error.message },
            { status: 500 }
        )
    }
}

function generateRecommendation(profile: any): string {
    const recs: string[] = []
    
    // Recommandation basée sur la vulnérabilité financière
    if (profile.financial?.isFinanciallyVulnerable) {
        if (profile.financial.urgentNeeds?.some((n: string) => 
            n.toLowerCase().includes('electric') || n.toLowerCase().includes('facture')
        )) {
            recs.push('Story FACTURE adaptée - Dette utilitaire identifiée')
        } else if (profile.financial.urgentNeeds?.some((n: string) => 
            n.toLowerCase().includes('loyer') || n.toLowerCase().includes('rent')
        )) {
            recs.push('Story URGENCE logement - Risque d\'expulsion')
        } else {
            recs.push('Story FACTURE générique - Pression financière détectée')
        }
    }
    
    // Recommandation basée sur la psychologie
    if (profile.psychology?.vulnerabilities?.includes('lonely')) {
        recs.push('Approche relationnelle - Solitude détectée')
    }
    
    if (profile.psychology?.vulnerabilities?.includes('seeking_validation')) {
        recs.push('Valider l\'écoute - Besoin de validation détecté')
    }
    
    return recs.join(' | ') || 'Profil stabilisé - Maintenir la conversation'
}
