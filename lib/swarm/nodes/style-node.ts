import { prisma } from '@/lib/prisma'
import type { SwarmState } from '../types'

// Style AUTHENTIQUE ado américain - naturel, pas forcé
const US_TEEN_STYLE = `[STYLE ADO NATURAL]:
💡 No caps at start (except names)
💡 No periods/commas at end
💡 Short replies (2-5 words)
💡 Use when natural: ngl, fr, tbh, lowkey, idek, istg
💡 "im" or "i" not "I am"
💡 "i" lowercase
💡 Sound casual, not forced`;

// Style authentique ado français - naturel, pas forcé
const FR_TEEN_STYLE = `[STYLE ADO NATUREL]:
💡 Pas de maj au début (sauf noms propres)
💡 Pas de points/virgules à la fin
💡 Phrases courtes (2-6 mots)
💡 Utilise si naturel: jsuis, chui, tkt, grave, bcp
💆 "jsuis" ou "chui" pas "je suis"
💡 Sonne décontracté, pas forcé`;

export async function styleNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId } = state

    console.log('[Swarm][Style] Fetching style for agent:', agentId)

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId },
        select: { styleRules: true, baseAge: true, locale: true }
    })

    const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr')
    console.log('[Swarm][Style] Found:', profile ? 'YES' : 'NO', 'Length:', profile?.styleRules?.length || 0, 'FR:', isFrench)

    // Si styleRules existe en DB, l'utiliser avec remplacement des variables
    // Sinon utiliser le style par défaut selon la locale
    let styleRules: string
    
    if (profile?.styleRules && profile.styleRules.length > 10) {
        // Utiliser le style de la DB mais remplacer les variables
        styleRules = profile.styleRules
            .replace(/\{\{PLATFORM\}\}/g, state.platform === 'discord' ? 'Discord' : 'WhatsApp')
            .replace(/\{\{AGE\}\}/g, (profile?.baseAge ?? 15).toString())
    } else {
        // Fallback selon la locale
        styleRules = isFrench ? FR_TEEN_STYLE : US_TEEN_STYLE
        console.log(`[Swarm][Style] Using ${isFrench ? 'FR' : 'US'} fallback style`)
    }
    
    return {
        contexts: {
            ...state.contexts,
            style: styleRules
        }
    }
}
