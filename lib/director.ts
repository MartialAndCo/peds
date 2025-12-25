
import { prisma } from '@/lib/prisma'

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS'

export const director = {
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

        // Logic Rule Engine
        // Phase A: Days 0-3 OR Trust < 20
        // Phase B: Days 3-6 AND Trust > 20
        // Phase C: Days 6+ AND Trust > 40

        let newPhase: AgentPhase = 'CONNECTION'

        if (daysActive >= 6 && trustScore > 40) {
            newPhase = 'CRISIS'
        } else if (daysActive >= 3 && trustScore > 20) {
            newPhase = 'VULNERABILITY'
        } else {
            newPhase = 'CONNECTION'
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

    /**
     * Updates trust score based on user message analysis (simple keyword heuristic for now).
     */
    async updateTrustScore(contactPhone: string, messageText: string) {
        let scoreDelta = 1 // +1 for just messaging

        const positiveKeywords = ['haha', 'lol', 'thanks', 'cool', 'love', 'nice', 'sweet', 'funny']
        const negativeKeywords = ['fake', 'bot', 'scam', 'stop', 'hate', 'lie', 'weird']

        const lowerText = messageText.toLowerCase()

        if (positiveKeywords.some(w => lowerText.includes(w))) scoreDelta += 5
        if (negativeKeywords.some(w => lowerText.includes(w))) scoreDelta -= 10

        // Cap change to avoid huge swings? Let's just apply for now.

        await prisma.contact.update({
            where: { phone_whatsapp: contactPhone },
            data: {
                trustScore: { increment: scoreDelta }
            }
        })

        console.log(`[Director] Trust Updated for ${contactPhone}: Delta ${scoreDelta}`)
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

${tGuardrails}

${tGlobal}
`
    }
}
