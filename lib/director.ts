
import { prisma } from '@/lib/prisma'

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'

export const director = {
    /**
     * Calculates the current phase based on days since contact creation and trust score.
     */
    /**
     * Calculates the current phase based on days since contact creation and trust score.
     */
    async determinePhase(contactPhone: string): Promise<{ phase: AgentPhase, details: any }> {
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone },
            include: { payments: true } // Include payments to check for MONEYPOT
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
        // Phase D (MONEYPOT): Has PAID at least once.
        // Phase A (CONNECTION): Default
        // Phase B (VULNERABILITY/CONFIDENCE): Days >= 3 AND Trust >= 50
        // Phase C (CRISIS): Days >= 6 AND Trust >= 80

        let newPhase: AgentPhase = 'CONNECTION'

        if (contact.payments && contact.payments.length > 0) {
            newPhase = 'MONEYPOT' as AgentPhase; // Force MoneyPot if paid
        } else if (daysActive >= 6 && trustScore >= 80) {
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



    async performDailyTrustAnalysis(contactPhone: string) {
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        });
        if (!contact) return;

        const now = new Date();
        const lastCheck = new Date(contact.lastTrustAnalysis);

        // Check if Same Day
        const isSameDay = now.getDate() === lastCheck.getDate() &&
            now.getMonth() === lastCheck.getMonth() &&
            now.getFullYear() === lastCheck.getFullYear();

        if (isSameDay) {
            // Already checked today.
            return;
        }

        console.log(`[Director] Performing Daily Trust Analysis for ${contactPhone}...`);
        await this.updateTrustScore(contactPhone, "");
    },

    /**
     * Updates the trust score based on the latest interaction.
     */
    async updateTrustScore(contactPhone: string, lastMessage: string) {
        // 1. Get Contact
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })
        if (!contact) return;

        // 2. Mock transcript (just last message for now to save tokens, or fetch history)
        // Ideally we fetch the last few messages.
        const recentMessages = await prisma.message.findMany({
            where: { conversation: { contactId: contact.id } },
            orderBy: { timestamp: 'desc' },
            take: 5
        })
        const transcript = recentMessages.reverse().map(m => `${m.sender}: ${m.message_text}`).join('\n');

        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc }, {})

        const defaultTrustPrompt = `Analyze the trust evolution in this conversation (Teenage Girl <-> User).
TRANSCRIPT (Last few messages):
${transcript}

Current Score: ${contact.trustScore}/100.

TASK:
Determine the NEW Trust Score (0-100).
- If the user is creepy, sexual, or aggressive -> DROP score significantly (-10 to -30).
- If the user is nice, normal, and respectful -> INCREASE score steadily (+5 to +10).
- If the user is neutral/boring -> MAINTAIN or slight increase (+2).

OUTPUT ONLY THE NEW INTEGER SCORE (e.g. "65").`;

        const prompt = settings.prompt_trust_analysis || defaultTrustPrompt;

        let newScoreStr = "50";
        const provider = settings.ai_provider || 'venice';

        try {
            if (provider === 'anthropic') {
                const { anthropic } = require('@/lib/anthropic')
                newScoreStr = await anthropic.chatCompletion("You are a Trust Analyzer. Output only a number.", [], prompt, { apiKey: settings.anthropic_api_key, model: 'claude-3-haiku-20240307' })
            } else {
                const { venice } = require('@/lib/venice')
                newScoreStr = await venice.chatCompletion("You are a Trust Analyzer. Output only a number.", [], prompt, { apiKey: settings.venice_api_key, model: 'venice-uncensored' })
            }
        } catch (e) {
            console.error("AI Trust Analysis failed", e);
            return;
        }

        const newScore = parseInt(newScoreStr.trim().replace(/[^0-9]/g, '')) || contact.trustScore;

        // 4. Update
        await prisma.contact.update({
            where: { id: contact.id },
            data: {
                trustScore: Math.min(100, Math.max(0, newScore)),
                lastTrustAnalysis: new Date()
            }
        });

        return newScore;
    },


    /**
     * Builds the full System Prompt using templates from Settings.
     * New Multi-Agent Aware Logic:
     * 1. Fetches Global Settings (API Keys)
     * 2. Fetches Agent Settings (Prompts/Behavior) if agentId is known
     * 3. Merges them (Agent overrides Global)
     */
    async buildSystemPrompt(
        settings: any, // Contains Global Settings passed from chat.ts
        contact: any,
        phase: AgentPhase,
        details: any,
        baseRole: string,
        agentId?: number
    ): Promise<string> {
        let mergedSettings = { ...settings };

        // 1. Fetch Agent Specific Settings if available
        if (agentId) {
            const agentSettings = await prisma.agentSetting.findMany({
                where: { agentId }
            });
            agentSettings.forEach(s => {
                mergedSettings[s.key] = s.value;
            });
            console.log(`[Director] Loaded ${agentSettings.length} overrides for Agent ${agentId}`);
        } else {
            console.warn('[Director] No Agent ID provided. Using global fallback.');
        }

        // 2. Get Templates from Merged Settings (with fallbacks)
        const tIdentity = mergedSettings.prompt_identity_template || "**1. IDENTITY**\nRole: {{ROLE}}"
        const tContext = mergedSettings.prompt_context_template || "**2. CONTEXT**\nUser: {{USER_NAME}}"
        const tMission = mergedSettings.prompt_mission_template || "**3. MISSION**\n{{DYNAMIC_GOAL_BLOCK}}"
        const tGuardrails = mergedSettings.prompt_guardrails || "**4. GUARDRAILS**..."
        const tGlobal = mergedSettings.prompt_global_rules || "[CRITICAL]: Real Person, Match Language."

        // 3. Get Phase Goal
        let phaseGoal = ""
        switch (phase) {
            case 'CONNECTION': phaseGoal = mergedSettings.phase_prompt_connection || "Be engaging."; break;
            case 'VULNERABILITY': phaseGoal = mergedSettings.phase_prompt_vulnerability || "Show vulnerability."; break;
            case 'CRISIS': phaseGoal = mergedSettings.phase_prompt_crisis || "URGENT: Crisis."; break;
            case 'MONEYPOT': phaseGoal = mergedSettings.phase_prompt_moneypot || "CLIENT/VIP MODE. Main goal: RETENTION. Treat him like your boyfriend. Be affectionate, compliant, and easy-going. STRATEGY: Maintain the relationship to keep him happy. Every few days (intermittently), ask for small amounts of money for 'cute' things (nails, bubble tea, new dress) or rent help, but DON'T be desperate like in Crisis phase. Make it feel natural. 'Baby, could you help me with my phone bill this month?'. If he says no, don't fight, just pout and move on. KEY: Keep him hooked long term."; break;
        }

        // 4. Assemble Blocks & Replace Placeholders
        const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })

        const pIdentity = tIdentity.replace('{{ROLE}}', baseRole)

        const pContext = tContext
            .replace('{{USER_NAME}}', contact.name || "friend")
            .replace('{{CURRENT_DATE}}', todayDate)
            .replace('{{DAYS_ACTIVE}}', details.daysActive.toString())
            .replace('{{TRUST_SCORE}}', details.trustScore.toString())
            .replace('{{PHASE}}', phase)

        const pMission = tMission.replace('{{DYNAMIC_GOAL_BLOCK}}', phaseGoal)

        // 5. Join with configurable rules/policies
        const sRules = mergedSettings.prompt_social_media_rules || ""
        const iRules = mergedSettings.prompt_image_handling_rules || ""
        const pRules = mergedSettings.prompt_payment_rules || ""
        const vPolicy = mergedSettings.prompt_voice_note_policy || ""
        const sInstructions = mergedSettings.prompt_style_instructions || ""

        const fullPrompt = `
### SYSTEM INSTRUCTIONS

${pIdentity}

${pContext}

${pMission}

${tGlobal}

${sRules}

${iRules}

${pRules}

${vPolicy}

${sInstructions}
`
        return fullPrompt.replace('{paypalUsername}', mergedSettings.paypal_username || '@lena9200')
    }
}
