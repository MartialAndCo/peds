import { venice } from '../venice'
import { logger } from '../logger'

/**
 * VOICE HUMANIZER SERVICE
 * 
 * Purpose: Takes clean AI text and "dirties it up" with human hesitations tailored for Audio.
 * Why: TTS sounds robotic without "euh", "bah", "genre", pauses, etc.
 * 
 * Strategy: Fast LLM call to rewrite text into "Spoken Oral Style".
 */
export const voiceHumanizer = {

    async humanize(text: string, locale: string = 'fr'): Promise<string> {
        // If text is very short, maybe just prepend a filler deterministically to save time?
        // But User wants "Exaggerated", so LLM is safer for context.

        const isFrench = locale.toLowerCase().startsWith('fr')

        // Fail-safe for empty
        if (!text || text.trim().length === 0) return text

        const systemPrompt = isFrench
            ? `Tu es un Moteur d'Humanisation Vocale.
TA TÂCHE : Réécrire le texte pour qu'il paraisse ORAL et SPONTANÉ (Jeune Adulte).

EXEMPLES (STYLE À SUIVRE) :
Input: "Je ne sais pas quoi faire."
Output: "Euh... en fait... j'sais pas trop quoi faire..."

Input: "C'est une bonne idée."
Output: "Bah ouais... c'est grave une bonne idée, tu vois ?"

RÈGLES CRITIQUES :
1. TICS DE LANGAGE : "euh...", "genre...", "fin...", "bref...", "du coup...".
2. HÉSITATIONS : Ajoute des "..." partout.
3. FAMILIER : "Je ne suis pas" -> "J'suis pas". "Il y a" -> "Y'a".
4. INTERDICTION : N'ajoute AUCUNE information qui n'est pas dans le texte.
5. Sortie : UNIQUEMENT le texte réécrit.`
            : `You are a Vocal Humanizer Engine.
TASK: Rewrite the text to sound SPOKEN and SPONTANEOUS (Young Adult).

EXAMPLES (STYLE TO MIMIC):
Input: "I don't know what to do."
Output: "Um... like... I dunno what to do, you know?"

Input: "That is a great idea."
Output: "Uh, yeah... that's like, actually a great idea..."

CRITICAL RULES:
1. FILLERS: "um...", "like...", "uh...", "actually...", "you know...".
2. HESITATIONS: Add "..." everywhere.
3. SHORTENINGS: "going to" -> "gonna", "I am" -> "I'm".
4. FORBIDDEN: Do NOT add information not present in source.
5. Output: ONLY the rewritten text.`

        // Add the input explicitly to force focus (Stable Pattern)
        const fullUserMessage = isFrench
            ? `TEXTE À RÉÉCRIRE : "${text}"`
            : `TEXT TO REWRITE: "${text}"`

        try {
            // Use a cheaper/faster model if possible (Haiku or Venice default)
            const humanizedText = await venice.chatCompletion(
                fullUserMessage,
                [],
                systemPrompt,
                { max_tokens: 200, temperature: 0.3 } // Verified stable by user & tests
            )

            const cleanResult = humanizedText.replace(/"/g, '').trim()

            logger.info('Voice Humanized', {
                module: 'voice-humanizer',
                original: text,
                result: cleanResult
            })

            return cleanResult

        } catch (e: any) {
            logger.error('Voice Humanizer Failed (Fallback to original)', e, { module: 'voice-humanizer' })
            // Fix lint: e is unknown, cast or use safely
            return text
        }
    }
}
