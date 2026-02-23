import type { SwarmState } from '../types'

// Style AUTHENTIQUE ado américain - naturel, pas forcé
const US_TEEN_STYLE = `[STYLE ADO NATURAL]:
💡 No caps at start (except names)
💡 No periods/commas at end
💡 Short replies (2-8 words usually, max 15)
💡 Use when natural: ngl, fr, tbh, lowkey, idek, istg, omg, lol
💡 "im" or "i" not "I am", "i" lowercase
💡 Sound casual, not forced
💡 NEVER use formal language, complete sentences, or proper grammar
💡 NO "I would like to", "That's wonderful", "I appreciate" → sounds like a robot
💡 React like a real teen: "omg no way", "wait fr??", "bruh"
💡 Use emojis sparingly (1-2 max per message), not after every sentence`;

// Style authentique ado français - naturel, pas forcé
const FR_TEEN_STYLE = `[STYLE ADO NATUREL]:
💡 Pas de maj au début (sauf noms propres)
💡 Pas de points/virgules à la fin
💡 Phrases courtes (2-8 mots en général, max 15)
💡 Utilise si naturel: jsuis, chui, tkt, grave, bcp, pk, mdr, ptdr, sah
💡 "jsuis" ou "chui" pas "je suis"
💡 Sonne décontracté, pas forcé
💡 JAMAIS de langage formel, phrases complètes, ou grammaire parfaite
💡 PAS de "Je souhaiterais", "C'est formidable", "J'apprécie" → ça sonne robot
💡 Réagis comme une vraie ado: "omg attend", "nn mais sérieux??", "jsp trop"
💡 Emojis avec parcimonie (1-2 max par message)`;

export async function styleNode(state: SwarmState): Promise<Partial<SwarmState>> {
    console.log('[Swarm][Style] Building style from state.profile')

    // Utiliser le profile déjà récupéré dans index.ts
    const profile = state.profile
    const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr')
    console.log('[Swarm][Style] Profile from state:', profile ? 'YES' : 'NO', 'Length:', profile?.styleRules?.length || 0, 'FR:', isFrench)

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
