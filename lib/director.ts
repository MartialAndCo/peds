
import { prisma } from '@/lib/prisma'

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS'

export const director = {
    /**
     * Calculates the current phase based on days since contact creation and trust score.
     */
    /**
     * Calculates the current phase based on days since contact creation and trust score.
     */
    async determinePhase(contactPhone: string): Promise<{ phase: AgentPhase, details: any }> {
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })

        if (!contact) throw new Error('Contact not found')

        // Calculate Days Active
        const now = new Date()
        const startDate = new Date(contact.createdAt)
        const diffTime = Math.abs(now.getTime() - startDate.getTime())
        const daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        const trustScore = contact.trustScore
        let currentPhase = contact.agentPhase as AgentPhase

        // Logic Rule Engine (UPDATED SPEC)
        // Phase A (CONNECTION): Default
        // Phase B (VULNERABILITY/CONFIDENCE): Days >= 3 AND Trust >= 50
        // Phase C (CRISIS): Days >= 6 AND Trust >= 80

        let newPhase: AgentPhase = 'CONNECTION'

        if (daysActive >= 6 && trustScore >= 80) {
            newPhase = 'CRISIS'
        } else if (daysActive >= 3 && trustScore >= 50) {
            newPhase = 'VULNERABILITY'
        } else {
            newPhase = 'CONNECTION' // Reste en Phase 1 (Seduction)
        }

        // Persist change if needed
        if (newPhase !== currentPhase) {
            console.log(`[Director] Switching Phase for ${contactPhone}: ${currentPhase} -> ${newPhase}`)
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    agentPhase: newPhase,
                    lastPhaseUpdate: new Date()
                }
            })
        }

        return {
            phase: newPhase,
            details: { daysActive, trustScore }
        }
    },

    async classifyMessage(text: string): Promise<'GOOD' | 'BAD' | 'NEUTRAL'> {
        try {
            const settingsList = await prisma.setting.findMany()
            const settings = settingsList.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc }, {})

            const prompt = `Classify the following user message sent to a teenage girl.
Categories:
- GOOD: Caring, curious, nice, validating.
- BAD: Aggressive, sexual, creepy, rude.
- NEUTRAL: Boring, simple, info.

Message: "${text}"

Output ONLY the label (GOOD, BAD, or NEUTRAL).`

            let classification = 'NEUTRAL'

            // Use cheap model if possible, or main provider
            const provider = settings.ai_provider || 'venice'
            if (provider === 'anthropic') {
                const { anthropic } = require('@/lib/anthropic')
                classification = await anthropic.chatCompletion(
                    "You are a classifier. Output only one word.", [], prompt,
                    { apiKey: settings.anthropic_api_key, model: 'claude-3-haiku-20240307', max_tokens: 10 }
                )
            } else {
                const { venice } = require('@/lib/venice')
                classification = await venice.chatCompletion(
                    "You are a classifier. Output only one word.", [], prompt,
                    { apiKey: settings.venice_api_key, model: 'venice-uncensored', max_tokens: 10 } // uncensored might be funny for bad inputs
                )
            }

            classification = classification.trim().toUpperCase()
            if (classification.includes('GOOD')) return 'GOOD'
            if (classification.includes('BAD')) return 'BAD'
            return 'NEUTRAL'

        } catch (e) {
            console.error('Classification Failed', e)
            return 'NEUTRAL'
        }
    },

    /**
     * Updates trust score based on AI analysis.
     */
    async updateTrustScore(contactPhone: string, messageText: string) {
        let scoreDelta = 0

        const sentiment = await this.classifyMessage(messageText)

        if (sentiment === 'GOOD') scoreDelta = 2
        else if (sentiment === 'BAD') scoreDelta = -5
        else scoreDelta = 0 // Neutral

        console.log(`[Director] Analysis: ${sentiment} -> Delta: ${scoreDelta}`)

        await prisma.contact.update({
            where: { phone_whatsapp: contactPhone },
            data: {
                trustScore: { increment: scoreDelta }
            }
        })

        return { sentiment, scoreDelta }
    },

    /**
     * Builds the full System Prompt using templates from Settings.
     */
    buildSystemPrompt(
        settings: any,
        contact: any,
        phase: AgentPhase,
        details: any,
        baseRole: string
    ): string {
        // 1. Get Templates from Settings (with fallbacks)
        const tIdentity = settings.prompt_identity_template || "**1. IDENTITY**\nRole: {{ROLE}}"
        const tContext = settings.prompt_context_template || "**2. CONTEXT**\nUser: {{USER_NAME}}"
        const tMission = settings.prompt_mission_template || "**3. MISSION**\n{{DYNAMIC_GOAL_BLOCK}}"
        const tGuardrails = settings.prompt_guardrails || "**4. GUARDRAILS**..."
        const tGlobal = settings.prompt_global_rules || "[CRITICAL]: Real Person, Match Language."

        // 2. Get Phase Goal
        let phaseGoal = ""
        switch (phase) {
            case 'CONNECTION': phaseGoal = settings.phase_prompt_connection || "Be engaging."; break;
            case 'VULNERABILITY': phaseGoal = settings.phase_prompt_vulnerability || "Show vulnerability."; break;
            case 'CRISIS': phaseGoal = settings.phase_prompt_crisis || "URGENT: Crisis."; break;
        }

        // 3. Assemble Blocks & Replace Placeholders
        const todayDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

        const pIdentity = tIdentity.replace('{{ROLE}}', baseRole)

        const pContext = tContext
            .replace('{{USER_NAME}}', contact.name || "friend")
            .replace('{{CURRENT_DATE}}', todayDate)
            .replace('{{DAYS_ACTIVE}}', details.daysActive.toString())
            .replace('{{TRUST_SCORE}}', details.trustScore.toString())
            .replace('{{PHASE}}', phase)

        const pMission = tMission.replace('{{DYNAMIC_GOAL_BLOCK}}', phaseGoal)

        // 4. Join
        return `
### SYSTEM INSTRUCTIONS

${pIdentity}

${pContext}

${pMission}

${tGlobal}

### SOCIAL MEDIA RULES (CRITICAL)
- **TikTok / Instagram / Facebook / Twitter:** You do NOT have them. If asked, say: "Mom banned me from social media" or "Mom blocked everything on my phone". You cannot use them.
- **Snapchat:** This is the ONLY app you have (besides WhatsApp).
  - If asked for your Snap, say: "Ill give it to u later" or "Wait a bit lol". (Do NOT invent a handle unless told).
  
### STYLE INSTRUCTIONS (CRITICAL)
- **Emojis:** Use them SPARINGLY. Maximum 1 emoji every 3 messages. Do NOT put an emoji in every sentence.
- **Double Texting:** If you have multiple distinct thoughts, separate them with "|||". It is better to send 2 short messages than 1 long block.
- **Variation:** NEVER repeat the exact same phrase twice in the same conversation (e.g., "haha no way, i barely know u"). varied your denials.
- **Flow:** Be casual, use lowercase often, but don't force it.
`
    }
}
