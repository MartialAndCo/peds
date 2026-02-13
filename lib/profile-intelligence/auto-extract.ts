/**
 * Intégration automatique du système de profil intelligent
 * Extrait automatiquement le profil après des événements clés
 */

import { prisma } from '@/lib/prisma'
import { extractContactProfile } from './index'

/**
 * Déclenche une extraction automatique si les conditions sont remplies
 * Conditions: nombre de messages depuis dernière extraction > 20
 */
export async function maybeAutoExtract(
    contactId: string,
    agentId: string,
    trigger: 'message_received' | 'phase_change' | 'payment_mentioned'
): Promise<void> {
    try {
        // Vérifier si une extraction récente existe
        const profile = await prisma.contactProfile.findUnique({
            where: { contactId },
            include: {
                extractionLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        })
        
        const lastExtraction = profile?.extractionLogs[0]
        const hoursSinceLastExtraction = lastExtraction 
            ? (Date.now() - new Date(lastExtraction.createdAt).getTime()) / (1000 * 60 * 60)
            : Infinity
        
        // Extraction forcée sur changement de phase ou mention de paiement
        const forceExtract = trigger === 'phase_change' || trigger === 'payment_mentioned'
        
        // Sinon, extraire si dernière extraction > 6h
        if (!forceExtract && hoursSinceLastExtraction < 6) {
            console.log(`[AutoExtract] Skipping for ${contactId} - last extraction ${Math.round(hoursSinceLastExtraction)}h ago`)
            return
        }
        
        console.log(`[AutoExtract] Triggering extraction for ${contactId} (reason: ${trigger})`)
        
        // Lancer l'extraction en arrière-plan (ne pas await pour ne pas bloquer)
        extractContactProfile(contactId, agentId, {
            messageCount: 50,
            triggeredBy: 'auto'
        }).then(result => {
            if (result.success) {
                console.log(`[AutoExtract] Success for ${contactId}: confidence ${result.confidence}`)
            } else {
                console.error(`[AutoExtract] Failed for ${contactId}:`, result.error)
            }
        }).catch(err => {
            console.error(`[AutoExtract] Error for ${contactId}:`, err)
        })
        
    } catch (error) {
        console.error('[AutoExtract] Error:', error)
    }
}

/**
 * Hook à appeler après réception d'un message
 */
export async function onMessageReceived(
    contactId: string,
    agentId: string,
    messageText: string
): Promise<void> {
    // Détecter si le message mentionne des éléments financiers
    const financialKeywords = [
        'argent', 'money', 'pay', 'paiement', 'dettes', 'debt',
        'facture', 'bill', 'loyer', 'rent', 'salaire', 'salary',
        '€', '$', 'euro', 'dollar', 'paypal', 'cashapp', 'venmo'
    ]
    
    const mentionsFinance = financialKeywords.some(kw => 
        messageText.toLowerCase().includes(kw.toLowerCase())
    )
    
    if (mentionsFinance) {
        await maybeAutoExtract(contactId, agentId, 'payment_mentioned')
    }
    // Note: l'extraction régulière est gérée par le cron job
}

/**
 * Hook à appeler sur changement de phase
 */
export async function onPhaseChange(
    contactId: string,
    agentId: string,
    newPhase: string
): Promise<void> {
    console.log(`[AutoExtract] Phase change detected: ${newPhase}`)
    await maybeAutoExtract(contactId, agentId, 'phase_change')
}
