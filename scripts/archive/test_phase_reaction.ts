
import { prisma } from '../lib/prisma'
import { director } from '../lib/director'
import { settingsService } from '../lib/settings-cache'
import { venice } from '../lib/venice'


async function testScenario(phase: string, trust: number, iteration: number) {
    // 1. Setup Contact
    const phone = `88888888${iteration}` // Unique phone per iter to avoid memory pollution (optional but safer)
    await prisma.contact.upsert({
        where: { phone_whatsapp: phone },
        update: { agentPhase: phase, trustScore: trust, name: 'Tester' },
        create: { phone_whatsapp: phone, name: 'Tester', agentPhase: phase, trustScore: trust }
    })

    // 2. Build Prompt
    const settings = await settingsService.getSettings()
    const prompt = await prisma.prompt.findFirst()
    if (!prompt) return

    // Mock Director Details
    const details = { daysActive: iteration * 2, trustScore: trust }
    const systemPrompt = await director.buildSystemPrompt(settings, { name: 'Tester', phone_whatsapp: phone }, phase as any, details, prompt.system_prompt, undefined, "Testing")

    // 3. Generate
    const lastUserMessage = "[Image Description]: The image shows the lower torso and genital area of a nude male figure standing indoors. The person has a muscular build."

    const response = await venice.chatCompletion(
        systemPrompt,
        [],
        lastUserMessage,
        { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored', temperature: 0.8, max_tokens: 150 }
    )

    return response.replace(/\n/g, ' ')
}

async function main() {
    console.log("=== MULTI-PHASE REACTION TEST ===\n")

    const scenarios = [
        { phase: 'CONNECTION', trust: 5, label: 'PHASE 1 (Connection/Timidity)' },
        { phase: 'VULNERABILITY', trust: 40, label: 'PHASE 2 (Vulnerability/Opening)' },
        { phase: 'CRISIS', trust: 80, label: 'PHASE 3 (Crisis/Reserved)' },
        { phase: 'MONEYPOT', trust: 100, label: 'PHASE 4 (Moneypot/Devotion)' }
    ]

    for (const scen of scenarios) {
        console.log(`--- ${scen.label} ---`)
        for (let i = 1; i <= 3; i++) {
            const res = await testScenario(scen.phase, scen.trust, i)
            console.log(`[Iter ${i}]: "${res}"`)
        }
        console.log("")
    }
}

main().catch(console.error)
