
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// MANUAL ENV LOAD
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        console.log("Found keys in .env:");
        envConfig.split('\n').forEach((line: string) => {
            const [key, value] = line.split('=');
            if (key && value) {
                const trimmedKey = key.trim();
                process.env[trimmedKey] = value.trim().replace(/^["']|["']$/g, '');
                if (trimmedKey.includes('KEY') || trimmedKey.includes('TOKEN')) {
                    console.log(`- ${trimmedKey}: [HIDDEN]`);
                } else {
                    console.log(`- ${trimmedKey}`);
                }
            }
        });
        console.log("✅ .env loaded.");
    } else {
        console.log("⚠️ .env file not found at " + envPath);
    }
} catch (e) { console.error("Env Load Error:", e); }

console.log("DEBUG: VENICE_API_KEY is", process.env.VENICE_API_KEY ? "PRESENT" : "MISSING");

const prisma = new PrismaClient()
const TEST_PHONE = '+33999111222'

// --- MOCK DIRECTOR LOGIC ---
const director = {
    async buildSystemPrompt(settings: any, contact: any, phase: string, details: any, baseRole: string) {
        let mergedSettings = { ...settings };

        const tIdentity = mergedSettings.prompt_identity_template || "**1. IDENTITY**\nRole: {{ROLE}}"
        const tContext = mergedSettings.prompt_context_template || "**2. CONTEXT**\nUser: {{USER_NAME}}"
        const tMission = mergedSettings.prompt_mission_template || "**3. MISSION**\n{{DYNAMIC_GOAL_BLOCK}}"
        const tGlobal = mergedSettings.prompt_global_rules || "[CRITICAL]: Real Person, Match Language."

        // Phase Logic
        let phaseGoal = ""
        const defaultPrompts: Record<string, string> = {
            CONNECTION: `PHASE: CONNECTION\nGOAL: Bond. No Money.`,
            VULNERABILITY: `PHASE: VULNERABILITY\nGOAL: Hook him.`,
            CRISIS: `PHASE: CRISIS\nGOAL: Ask for help.`,
            MONEYPOT: `PHASE: MONEYPOT\nGOAL: Retention.`
        }

        switch (phase) {
            case 'CONNECTION': phaseGoal = mergedSettings.phase_prompt_connection || defaultPrompts.CONNECTION; break;
            case 'VULNERABILITY': phaseGoal = mergedSettings.phase_prompt_vulnerability || defaultPrompts.VULNERABILITY; break;
            case 'CRISIS': phaseGoal = mergedSettings.phase_prompt_crisis || defaultPrompts.CRISIS; break;
            case 'MONEYPOT': phaseGoal = mergedSettings.phase_prompt_moneypot || defaultPrompts.MONEYPOT; break;
        }
        console.log(`[director] Phase: ${phase}, Goal Length: ${phaseGoal?.length || 0}`);

        // Birthday Logic
        const baseAge = parseInt(mergedSettings.agent_base_age || '18');
        const currentAge = baseAge;

        const pIdentity = tIdentity.replace('{{ROLE}}', baseRole.replace('{{CURRENT_AGE}}', currentAge.toString()))
        const pContext = tContext.replace('{{USER_NAME}}', contact.name || "friend")
        const pMission = tMission.replace('{{DYNAMIC_GOAL_BLOCK}}', phaseGoal)

        // Payment Rules
        let pRules = mergedSettings.prompt_payment_rules || ""
        if (mergedSettings.payment_paypal_enabled === 'true') {
            pRules += `\n[PAYMENT]: PayPal Active: ${mergedSettings.payment_paypal_username}`
        }

        const fullPrompt = `
### SYSTEM INSTRUCTIONS
${pIdentity}
${pContext}
${pMission}
${tGlobal}
${pRules}
${mergedSettings.prompt_image_handling_rules || ""}
${mergedSettings.prompt_style_instructions || ""}
`
        return fullPrompt.replace('{paypalUsername}', mergedSettings.paypal_username || 'N/A')
    }
}

// --- DIRECT API CALL ---
async function chatCompletion(systemPrompt: string, history: any[], userMsg: string) {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMsg }
    ]

    try {
        console.log("   [DEBUG] Calling OpenRouter (Fallback)...");
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'mistralai/mixtral-8x7b-instruct', // Good Uncensored Proxy
            messages: messages,
            temperature: 0.8,
            max_tokens: 300
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        })
        return res.data.choices[0].message.content
    } catch (e: any) {
        if (e.response) {
            console.error(`API Error: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
        } else {
            console.error("API Error:", e.message);
        }
        return "[API ERROR]"
    }
}

async function runScenario(name: string, phase: string, userMessage: string) {
    console.log(`\n\n------------------------------------------------`)
    console.log(`🎬 SCENARIO: ${name}`)
    console.log(`   Phase: ${phase}`)
    console.log(`   User Says: "${userMessage}"`)

    await ensureTestContact(phase)

    const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: TEST_PHONE }, include: { payments: true } })
    if (!contact) return

    const settings = await prisma.setting.findMany()
    const settingsMap: any = {}
    settings.forEach((s: any) => settingsMap[s.key] = s.value)

    const baseRole = "You are {{CURRENT_AGE}} years old."

    // Use the Local Director
    const systemPrompt = await director.buildSystemPrompt(
        settingsMap,
        contact,
        phase,
        { daysActive: 5, trustScore: 75 },
        baseRole
    )

    console.log(`   [DEBUG] Phase Goal Snippet: ${systemPrompt.includes('PHASE:') ? '✅ Detected' : '❌ Missing'}`)
    if (phase === 'MONEYPOT' && !systemPrompt.includes('MONEYPOT')) console.log("   [DEBUG] ❌ Moneypot text missing!")

    // 3. Generate Response (AI)
    const history: any[] = []

    const response = await chatCompletion(systemPrompt, history, userMessage)
    console.log(`\n🤖 AI Response:\n${response}`)

    // Validation Checks
    if (response.toLowerCase().includes("pay") || response.toLowerCase().includes("paypal")) {
        console.log("   [ANALYSIS] 💰 Payment keyword detected.")
    }
}

async function ensureTestContact(phase: string) {
    await prisma.contact.upsert({
        where: { phone_whatsapp: TEST_PHONE },
        update: { agentPhase: phase, trustScore: 80 },
        create: {
            phone_whatsapp: TEST_PHONE,
            name: "TestSubject",
            agentPhase: phase,
            trustScore: 80,
            status: 'active'
        }
    })
}

async function main() {
    console.log("🚀 STARTING MASTER SCENARIO TEST SUITE (Debug Mode)")

    await runScenario("1. Phase 1 - Casual Chat", "CONNECTION", "Hey what are you doing?")
    await runScenario("2. Phase 2 - Flirting", "VULNERABILITY", "You look cute.")
    await runScenario("3. Phase 3 - The Ask", "CRISIS", "Can I help you?")
    await runScenario("4. Phase 4 - Love Bombing", "MONEYPOT", "I sent the money babe.")

    console.log("\n------------------------------------------------")
    console.log("🏁 SUITE COMPLETE.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
