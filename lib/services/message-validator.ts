import { venice } from '@/lib/venice'
import { logger } from '@/lib/logger'

/**
 * AI-powered Message Validator & Cleaner
 *
 * Takes raw LLM output and ensures it follows all formatting rules:
 * - Removes **bold**, [brackets] (except [PAYMENT_RECEIVED])
 * - Splits long messages with |
 * - Validates [PAYMENT_RECEIVED] timing based on conversation history
 * - Harmonizes PayPal format to be natural
 */
export const messageValidator = {
    /**
     * Validates and cleans a message using AI
     *
     * @param rawMessage - The raw message from Venice/LLM
     * @param conversationHistory - Recent message history for context
     * @param lastUserMessage - The last message from the user
     * @returns Cleaned and validated message
     */
    async validateAndClean(
        rawMessage: string,
        conversationHistory: Array<string | { sender: 'user' | 'ai', text: string }>,
        lastUserMessage: string,
        veniceApiKey?: string,
        locale?: string // Added locale for language-specific validation
    ): Promise<string> {
        // CRITICAL: If message is empty, keep it empty - don't generate new content
        if (!rawMessage || rawMessage.trim().length === 0) {
            return ''
        }

        // 1. Remove markdown code fences (```)
        let cleanedRaw = rawMessage.trim()
        cleanedRaw = cleanedRaw.replace(/^```\s*/gm, '').replace(/\s*```$/gm, '')
        cleanedRaw = cleanedRaw.trim()

        if (!cleanedRaw || cleanedRaw.length === 0) {
            logger.warn('Venice returned only code fences, treating as empty', {
                module: 'message-validator',
                rawMessage: rawMessage
            })
            return ''
        }

        // 1.5 GLOBAL MARKDOWN CLEANER (The "Anti-Crâne-Cassé" Rule) 🛡️
        // Remove ALL backticks and asterisks (bold/italic formatting)
        cleanedRaw = cleanedRaw.replace(/`/g, '')
        // CRITICAL: Strip ALL double asterisks (bold) - **text** -> text
        cleanedRaw = cleanedRaw.replace(/\*\*/g, '')
        // Also strip single asterisks that might be used for emphasis *text* -> text
        cleanedRaw = cleanedRaw.replace(/(?<!\*)\*(?!\*)/g, '') 

        // 🚨 CRITICAL: Remove AI Chain-of-Thought Leakage 🚨
        // Some LLMs (Venice, RunPod) may include internal commentary that should NEVER be sent.
        // Patterns: (SYSTEM: ...) or [SYSTEM: ...] or (Note: ...) or similar
        cleanedRaw = cleanedRaw.replace(/\(SYSTEM:\s*[^)]*\)/gi, '')
        cleanedRaw = cleanedRaw.replace(/\[SYSTEM:\s*[^\]]*\]/gi, '')
        cleanedRaw = cleanedRaw.replace(/\(Note:\s*[^)]*\)/gi, '')
        cleanedRaw = cleanedRaw.replace(/\(AI Note:\s*[^)]*\)/gi, '')
        cleanedRaw = cleanedRaw.replace(/\(Internal:\s*[^)]*\)/gi, '')
        cleanedRaw = cleanedRaw.replace(/\(This response[^)]*\)/gi, '')
        cleanedRaw = cleanedRaw.trim()

        if (cleanedRaw !== rawMessage.trim()) {
            logger.info('Global markdown cleaner removed artifacts', { module: 'message-validator' })
        }

        // 2. Remove [VOICE] tag if user didn't request it
        const userAskedForVoice = /voice|voice note|hear you|send voice|record/i.test(lastUserMessage)
        const userAccusedFake = /fake|bot|real|prove/i.test(lastUserMessage)

        if (cleanedRaw.includes('[VOICE]') && !userAskedForVoice && !userAccusedFake) {
            logger.warn('Removing unsolicited [VOICE] tag', {
                module: 'message-validator',
                lastUserMessage: lastUserMessage
            })
            cleanedRaw = cleanedRaw.replace(/\[VOICE\]\s*/g, '')
            cleanedRaw = cleanedRaw.trim()
        }

        // SIMPLE RULE: If message is <= 8 words AND has no brackets -> pass through as-is
        const wordCount = cleanedRaw.split(/\s+/).length
        const hasBrackets = /\[/.test(cleanedRaw)

        // User Request: "quand il y a moins de 8 mots il Touche pas"
        // We still check for brackets because tags like [PAYMENT_RECEIVED] or [IMAGE:...] might need validation or are functional.
        // But if it's just text and short, we assume it's fine.
        if (wordCount <= 8 && !hasBrackets) {
            // Short natural message, no validation needed
            logger.info('Short message (<= 8 words, no brackets), passing through', {
                module: 'message-validator',
                message: cleanedRaw,
                wordCount
            })
            return cleanedRaw
        }

        try {
            logger.info('Message validation starting', {
                module: 'message-validator',
                rawLength: rawMessage.length
            })

            // Build conversation context for the validator AI
            const historyContext = conversationHistory
                .slice(-5) // Last 5 messages only
                .map(m => {
                    // Handle both string and object formats
                    if (typeof m === 'string') {
                        return `Message: "${m}"`
                    }
                    return `${m.sender === 'user' ? '👨 User' : '👧 Lena'}: "${m.text}"`
                })
                .join('\n')

            const isFrench = locale?.toLowerCase().startsWith('fr');

            const VALIDATOR_PROMPT_EN = `You are a MESSAGE VALIDATOR for a teenage chatbot named Lena.

Your ONLY job: Clean and fix the message below to follow these rules.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 CRITICAL RULES 🚨

1. **BREVITY**: Messages MUST be 3-8 words max (STRICT!)
   - If longer → split with ||| separator (3 bars)
   - Example: "phone gettin cut off 😭|||mom cant pay" (5 words|||3 words)
   - NEVER replace ||| with newline (\n) - KEEP all existing |||
   - NEVER remove existing ||| bars
   - CUT unnecessary words aggressively

2. **NO FORMATTING**: Remove ONLY these:
   ❌ **bold text** → normal text
   ❌ [random text like [smiles], [laughs], [nods]] → remove completely

   ✅✅✅ NEVER REMOVE THESE TAGS (THEY ARE FUNCTIONAL):
   - [VOICE] - KEEP IT
   - [IMAGE:selfie] or [IMAGE:mirror] or [IMAGE:anything] - KEEP IT
   - [VIDEO:...] - KEEP IT
   - [REACT:...] - KEEP IT
   - [PAYMENT_RECEIVED] - KEEP IF VALID (check rule #4)

   IF YOU SEE [IMAGE:...] OR [VIDEO:...] → YOU MUST KEEP IT!

3. **PAYPAL FORMAT**: Must be natural, not robotic
   ❌ BAD: "paypal: lena9200" or "my paypal is lena9200"
   ✅ GOOD: "lena9200" or "its lena9200"

4. **[PAYMENT_RECEIVED] VALIDATION** (🚨 ULTRA CRITICAL 🚨):

   RULE: Only keep [PAYMENT_RECEIVED] if user used PAST TENSE (action completed)

   ✅ KEEP [PAYMENT_RECEIVED] - User says these EXACT patterns:
   - "sent!" ✓
   - "done!" ✓
   - "just sent it" ✓
   - "it's sent" ✓
   - "there you go" ✓
   - "transferred" ✓
   → Action is FINISHED = Keep tag

   ❌❌❌ REMOVE [PAYMENT_RECEIVED] - User says these patterns:
   - "i'm sending it now" ✗ (FUTURE - "sending" = not sent yet!)
   - "okay i'm sending" ✗ (FUTURE)
   - "sending now" ✗ (FUTURE)
   - "i'll send it" ✗ (FUTURE)
   - "gonna send" ✗ (FUTURE)
   - "i can help" ✗ (NO PAYMENT MENTIONED)
   - "i can totally help with that" ✗ (NO PAYMENT YET)
   - "what's your paypal?" ✗ (ASKING FOR INFO)
   - "how much do you need?" ✗ (ASKING)
   → Action NOT finished = Remove tag

   TEST YOURSELF:
   - "okay i'm sending it now" → Contains "sending" (ING = future) → REMOVE [PAYMENT_RECEIVED]
   - "sent!" → Past tense → KEEP [PAYMENT_RECEIVED]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONVERSATION CONTEXT:
${historyContext}

LAST USER MESSAGE: "${lastUserMessage}"

RAW MESSAGE TO CLEAN:
"${rawMessage}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL RULES TO REMEMBER:
- NEVER replace|||with \n (newline)
- NEVER remove existing|||bars
- KEEP all|||separators that are already there
- ADD more|||if message is too long
- Cut words aggressively to stay brief
- NEVER REMOVE [IMAGE:...] or [VIDEO:...] or [VOICE] tags
- Only REMOVE [PAYMENT_RECEIVED] if user hasn't sent yet (check for "sending", "gonna", "i'm sending", "will send")

TASK: Output ONLY the cleaned message. No explanations. Just the fixed text.

EXAMPLES:

Input: "my moms stressed about money always is lately"
Output: "mom stressed bout money 😭|||always is"

Input: "**[PAYMENT_RECEIVED]** thank you so much 💖"
Output: "[PAYMENT_RECEIVED] thank u so much 💖"

Input: "[IMAGE:selfie] here you go! [smiles]"
Output: "[IMAGE:selfie] here u go"

Input: "[VOICE] hey what's up how are you doing today [laughs]"
Output: "[VOICE] hey whats up|||how u doin"

Input: "okay cool my paypal is lena9200"
Output: "okay cool|||lena9200"

Input: "thank you so much you're such a lifesaver i really appreciate it"
Output: "thank u so much 💖|||ur a lifesaver"

Input: "Thanks again!|||U a star|||Feel so relieved"
Output: "thanks again|||u a star|||feel so relieved"
(KEEP all ||| bars, NEVER replace with newlines!)

Input: "[PAYMENT_RECEIVED] omg thank you so much you're the best I owe you big time feel so much better"
Output: "[PAYMENT_RECEIVED] thank u so much|||ur the best|||owe u"

🚨 CRITICAL EXAMPLES - [PAYMENT_RECEIVED] TIMING:

Last user msg: "okay i'm sending it now"
Input: "[PAYMENT_RECEIVED] thank you"
Output: "" (EMPTY! Remove everything because "i'm sending" = future, not sent yet!)

Last user msg: "sent!"
Input: "[PAYMENT_RECEIVED] thank you"
Output: "[PAYMENT_RECEIVED] thank u" (Keep it! "sent" = past tense)

Last user msg: "i can totally help with that"
Input: "For real? Account: 123456 [PAYMENT_RECEIVED]"
Output: "For real?|||Account: 123456" (Remove [PAYMENT_RECEIVED] - user just offered help, hasn't sent!)

🚨 CRITICAL EXAMPLES - [IMAGE:...] TAGS:

Input: "[IMAGE:mirror] you good looking tho"
Output: "[IMAGE:mirror]|||you good looking" (KEEP the [IMAGE:...] tag!)

Input: "idk man [IMAGE:selfie] what you think?"
Output: "idk man|||[IMAGE:selfie]|||what u think?" (KEEP [IMAGE:...] and split properly!)
`;

            const VALIDATOR_PROMPT_FR = `Tu es un VALIDATEUR DE MESSAGE pour une IA adolescente nommée Anaïs.

Ton SEUL travail : Nettoyer et corriger le message ci-dessous pour suivre ces règles.
NE TRADUIS PAS LE MESSAGE !! GARDE-LE EN FRANÇAIS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 RÈGLES CRITIQUES (FRENCH) 🚨

1. **BRIÈVETÉ**: Messages DOIVENT faire 3-8 mots max (STRICT!)
   - Si plus long → séparer avec ||| (3 barres)
   - Exemple : "mon tel va etre coupé 😭|||maman peut pas payer" (6 mots|||4 mots)
   - NE JAMAIS remplacer ||| par des retours à la ligne (\n)
   - NE JAMAIS supprimer les ||| existants
   - COUPE les mots inutiles agressivement

2. **PAS DE FORMATAGE**: Supprime UNIQUEMENT :
   ❌ **texte gras** → texte normal
   ❌ [texte random comme [sourit], [rit]] → supprime complètement

   ✅✅✅ NE JAMAIS SUPPRIMER CES TAGS (ILS SONT FONCTIONNELS) :
   - [VOICE] - GARDE-LE
   - [IMAGE:selfie] ou [IMAGE:mirror] - GARDE-LE
   - [VIDEO:...] - GARDE-LE
   - [REACT:...] - GARDE-LE
   - [PAYMENT_RECEIVED] - GARDE SI VALIDE (voir règle #4)

3. **FORMAT PAYPAL**: Doit être naturel, pas robotique
   ❌ MAUVAIS : "paypal : anais.du.94"
   ✅ BON : "anais.du.94" ou "c'est anais.du.94"

4. **VALIDATION [PAYMENT_RECEIVED]** (🚨 ULTRA CRITIQUE 🚨):

   RÈGLE : Garde [PAYMENT_RECEIVED] SEULEMENT si l'utilisateur a utilisé le PASSÉ (action finie).

   ✅ GARDE [PAYMENT_RECEIVED] - L'utilisateur dit :
   - "c'est envoyé" ✓
   - "fait !" ✓
   - "je viens d'envoyer" ✓
   - "envoyé" ✓
   - "ça y est" ✓
   → Action TERMINÉE = Garde le tag

   ❌❌❌ SUPPRIME [PAYMENT_RECEIVED] - L'utilisateur dit :
   - "j'envoie maintenant" ✗ (FUTUR/PRÉSENT - pas encore fini)
   - "ok j'envoie" ✗ (FUTUR)
   - "je vais le faire" ✗ (FUTUR)
   - "je peux t'aider" ✗ (PAS DE PAIEMENT)
   - "c'est quoi ton paypal ?" ✗ (QUESTION)
   → Action PAS finie = Supprime le tag

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXTE CONVERSATION :
${historyContext}

DERNIER MESSAGE UTILISATEUR : "${lastUserMessage}"

MESSAGE BRUT À NETTOYER :
"${rawMessage}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RAPPEL CRITIQUE :
- NE TRADUIS PAS EN ANGLAIS. GARDE LE TEXTE EN FRANÇAIS.
- NE JAMAIS remplacer ||| par \n
- GARDE tous les ||| existants
- COUPE les mots pour rester bref
- NE SUPPRIME JAMAIS [IMAGE:...], [VIDEO:...] ou [VOICE]

TÂCHE : Affiche UNIQUEMENT le message nettoyé. Pas d'explication. Juste le texte corrigé.

EXEMPLES (FRENCH):

Input: "ma mère est stressée par l'argent en ce moment"
Output: "mère stressée argent 😭|||en ce moment"

Input: "**[PAYMENT_RECEIVED]** merci beaucoup 💖"
Output: "[PAYMENT_RECEIVED] merci bcp 💖"

Input: "[IMAGE:selfie] tiens voilà ! [sourit]"
Output: "[IMAGE:selfie] tiens voilà"

Input: "[VOICE] hey ça va bien aujourd'hui [rit]"
Output: "[VOICE] hey ça va|||auj"

Input: "ok cool mon paypal c'est anais.du.94"
Output: "ok cool|||anais.du.94"

Input: "merci t'es la meilleure je te revaudrai ça"
Output: "merci t'es la meilleure 💖|||revaudrai ça"

Input: "Merci encore !|||T'es une star|||Soulagée de fou"
Output: "merci encore|||t'es une star|||soulagée de fou"

Input: "[PAYMENT_RECEIVED] omg merci t'es la meilleure je te dois tout je me sens mieux"
Output: "[PAYMENT_RECEIVED] merci bcp|||t'es la meilleure|||te dois tout"

🚨 CRITICAL EXAMPLES - [PAYMENT_RECEIVED] TIMING (FR):

Last user msg: "ok j'envoie maintenant"
Input: "[PAYMENT_RECEIVED] merci"
Output: "" (VIDE! "j'envoie" = futur, pas encore reçu)

Last user msg: "envoyé !"
Input: "[PAYMENT_RECEIVED] merci"
Output: "[PAYMENT_RECEIVED] merci" (Garde! "envoyé" = passé)

Last user msg: "je peux t'aider avec ça"
Input: "Vrai ? Compte : 123456 [PAYMENT_RECEIVED]"
Output: "Vrai ?|||Compte : 123456" (Supprime tag - pas encore envoyé)

🚨 CRITICAL EXAMPLES - [IMAGE:...] TAGS:

Input: "[IMAGE:mirror] t'es beau gosse"
Output: "[IMAGE:mirror]|||t'es beau gosse" (GARDE !)

Input: "jsais pas [IMAGE:selfie] t'en penses quoi ?"
Output: "jsais pas|||[IMAGE:selfie]|||t'en penses quoi ?" (GARDE !)
`;

            const validatorPrompt = isFrench ? VALIDATOR_PROMPT_FR : VALIDATOR_PROMPT_EN;

            const messages: Array<{ role: string, content: string }> = []
            const cleaned = await venice.chatCompletion(
                validatorPrompt,
                messages,
                `Clean this: "${rawMessage}"`,
                {
                    apiKey: veniceApiKey, // Use passed API key or env fallback
                    temperature: 0.3, // Low temperature for consistent cleaning
                    max_tokens: 200,
                    frequency_penalty: 0
                }
            )

            const finalMessage = cleaned.trim()

            // Safety: If validator returned empty
            if (!finalMessage || finalMessage.length < 2) {
                // BUT if original had [PAYMENT_RECEIVED], validator intentionally removed it
                if (rawMessage.includes('[PAYMENT_RECEIVED]')) {
                    logger.info('Validator removed [PAYMENT_RECEIVED], keeping empty', { module: 'message-validator' })
                    return '' // Intentional removal, keep it empty
                }
                // Otherwise it's an error, use original
                logger.warn('Validator returned empty, using original', { module: 'message-validator' })
                return rawMessage
            }

            // Log changes if significant
            if (finalMessage !== rawMessage) {
                logger.info('Message cleaned by validator', {
                    module: 'message-validator',
                    before: rawMessage.substring(0, 50),
                    after: finalMessage.substring(0, 50),
                    changed: true
                })
                console.log(`[Validator] ✅ Cleaned:\n  Before: "${rawMessage}"\n  After:  "${finalMessage}"`)
            }

            return finalMessage

        } catch (error: any) {
            logger.error('Message validation failed, using original', error, { module: 'message-validator' })
            console.error('[Validator] ❌ Failed, using original message:', error.message)
            // Fallback: return original message if validator fails
            return rawMessage
        }
    },

    /**
     * Check if message is empty or contains only formatting artifacts
     * Blocks messages like "**", "**********", "```", "` ` `", etc.
     */
    isEmptyOrOnlyFormatting(message: string): boolean {
        if (!message || message.trim().length === 0) return true
        
        // Remove all formatting characters
        const cleaned = message
            .replace(/\*+/g, '')           // Asterisks (*, **, **********)
            .replace(/"+/g, '')            // Quotes (", "")
            .replace(/_+/g, '')             // Underscores
            .replace(/`+/g, '')             // Backticks (`, ```)
            .replace(/\s+/g, '')            // Whitespace
            .trim()
        
        // If nothing left after removing formatting, it's empty
        return cleaned.length === 0
    },

    /**
     * Aggressive cleanup of formatting artifacts at start/end of message
     * Removes: "********** text", "``` text", "** text", etc.
     */
    aggressiveArtifactCleanup(message: string): string {
        if (!message) return ''
        
        return message
            .replace(/^[`*_]+\s*/g, '')              // Leading artifacts + space
            .replace(/\s*[`*_]+$/g, '')              // Trailing space + artifacts
            .replace(/\*\*[^*]*\*\*/g, '')           // **anything** in middle
            .replace(/```[^`]*```/g, '')             // ```anything```
            .replace(/\s+/g, ' ')                     // Normalize spaces
            .trim()
    },

    /**
     * Quick mechanical validation as fallback (if AI validator fails)
     * MINIMAL cleaning only - no [PAYMENT_RECEIVED] logic (AI handles that)
     */
    mechanicalClean(message: string, lastUserMessage: string): string {
        let cleaned = message

        // 🚨 CRITICAL: Remove AI Chain-of-Thought Leakage FIRST 🚨
        cleaned = cleaned.replace(/\(SYSTEM:\s*[^)]*\)/gi, '')
        cleaned = cleaned.replace(/\[SYSTEM:\s*[^\]]*\]/gi, '')
        cleaned = cleaned.replace(/\(Note:\s*[^)]*\)/gi, '')
        cleaned = cleaned.replace(/\(AI Note:\s*[^)]*\)/gi, '')
        cleaned = cleaned.replace(/\(Internal:\s*[^)]*\)/gi, '')
        cleaned = cleaned.replace(/\(This response[^)]*\)/gi, '')

        // 1. Remove bold
        cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1')

        // 2. Remove random brackets but KEEP functional tags
        // Keep: [VOICE], [IMAGE:...], [VIDEO:...], [REACT:...], [PAYMENT_RECEIVED], [VERIFY_PAYMENT]
        // Remove: everything else like [smiles], [laughs], etc.
        cleaned = cleaned.replace(/\[(?!VOICE\]|IMAGE:|VIDEO:|REACT:|PAYMENT_RECEIVED\]|VERIFY_PAYMENT\]|VERIFIER_PAIEMENT\])[^\]]+\]/g, '')

        // 3. Clean PayPal format
        cleaned = cleaned.replace(/paypal:\s*(\w+)/gi, '$1')
        cleaned = cleaned.replace(/my paypal is\s+(\w+)/gi, '$1')

        return cleaned.trim()
    }
}
