
import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { prisma } from '../lib/prisma.ts'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

// Mock Logger
const logger = { info: console.log, error: console.error }

// INLINED VENICE CALLER (Same as before)
const venice = {
    async chatCompletion(systemPrompt: string, messages: any[], userMessage: string, config: any = {}) {
        let apiKey = process.env.VENICE_API_KEY

        if (!apiKey) {
            const setting = await prisma.setting.findFirst({
                where: { key: 'venice_api_key' }
            })
            apiKey = setting?.value
        }

        if (!apiKey) throw new Error("VENICE_API_KEY missing (checked .env and DB)")

        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages,
            { role: 'user', content: userMessage }
        ]

        try {
            const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
                model: 'venice-uncensored',
                messages: apiMessages,
                temperature: config.temperature ?? 0.8,
                max_tokens: config.max_tokens ?? 200
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            })
            return response.data.choices[0]?.message?.content || ""
        } catch (error: any) {
            console.error('Venice Call Failed:', error.response?.data || error.message)
            return ""
        }
    }
}

// INLINED HUMANIZER SERVICE with REFINED PROMPTS
const voiceHumanizer = {
    async humanize(text: string, locale: string = 'fr'): Promise<string> {
        const isFrench = locale.toLowerCase().startsWith('fr')
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

        // Add the input explicitly to force focus
        const fullUserMessage = isFrench
            ? `TEXTE À RÉÉCRIRE : "${text}"`
            : `TEXT TO REWRITE: "${text}"`

        const humanizedText = await venice.chatCompletion(
            systemPrompt,
            [],
            fullUserMessage,
            { max_tokens: 200, temperature: 0.3 } // User suggested 0.3 for Venice stability
        )
        return humanizedText.replace(/"/g, '').trim()
    }
}

// EXTENSIVE TEST RUNNER
async function runTest() {
    console.log('🧪 COMPREHENSIVE HUMANIZER TEST REPORT\n')

    const scenarios = [
        { cat: "GREETING", lang: 'fr', text: "Salut, c'est Anaïs." },
        { cat: "GREETING", lang: 'en', text: "Hey, it's Lena." },

        { cat: "TIRED", lang: 'fr', text: "Je suis trop fatiguée ce soir, je vais juste dormir je pense." },
        { cat: "TIRED", lang: 'en', text: "I'm so tired tonight, I think I'm just gonna sleep." },

        { cat: "EXCITED", lang: 'fr', text: "C'est génial ! J'ai tellement hâte de te voir demain !" },
        { cat: "EXCITED", lang: 'en', text: "That's awesome! I can't wait to see you tomorrow!" },

        { cat: "HESITANT", lang: 'fr', text: "Je ne suis pas sûre, c'est un peu risqué non ?" },
        { cat: "HESITANT", lang: 'en', text: "I'm not sure, isn't that a bit risky?" },

        { cat: "ANNOYED", lang: 'fr', text: "Tu m'écoutes jamais quand je parle, c'est pénible." },
        { cat: "ANNOYED", lang: 'en', text: "You never listen when I talk, it's annoying." },

        { cat: "FLIRTY", lang: 'fr', text: "T'es mignon quand tu t'énerves." },
        { cat: "FLIRTY", lang: 'en', text: "You're cute when you get angry." },

        { cat: "TECHNICAL", lang: 'fr', text: "Il faut cliquer sur le bouton rouge pour valider." },
        { cat: "TECHNICAL", lang: 'en', text: "You have to click the red button to confirm." }
    ]

    for (const test of scenarios) {
        console.log(`[${test.cat}] [${test.lang.toUpperCase()}]`)
        console.log(`Input:      "${test.text}"`)

        const start = Date.now()
        const humanized = await voiceHumanizer.humanize(test.text, test.lang)
        const duration = Date.now() - start

        console.log(`Output:     "${humanized}"`)
        console.log(`Time:       ${duration}ms`)
        console.log('---------------------------------------------------')
    }

    process.exit(0)
}

runTest()
