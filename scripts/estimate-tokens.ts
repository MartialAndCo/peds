import { PrismaClient } from '@prisma/client'
import { director } from '../lib/director'
import { settingsService } from '../lib/settings-cache'

const prisma = new PrismaClient()

// Simple token estimation (GPT-style: ~4 chars per token for English, ~3 for French)
function estimateTokens(text: string, locale: string): number {
    const charsPerToken = locale.startsWith('fr') ? 3.5 : 4
    return Math.ceil(text.length / charsPerToken)
}

async function main() {
    console.log('📊 PROMPT TOKEN ESTIMATION\n')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    const settings = await settingsService.getSettings()

    const testContact = {
        id: 'test',
        phone_whatsapp: '+1234567890',
        name: 'Test User',
        createdAt: new Date()
    }

    const phases = ['CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT'] as const

    for (const agent of agents) {
        console.log(`\n${'═'.repeat(50)}`)
        console.log(`📋 ${agent.name} (${agent.profile?.locale || 'unknown'})`)
        console.log('═'.repeat(50))

        const locale = agent.profile?.locale || 'en-US'

        // Profile size
        const profileSize = agent.profile ? [
            agent.profile.contextTemplate,
            agent.profile.missionTemplate,
            agent.profile.identityTemplate,
            agent.profile.phaseConnectionTemplate,
            agent.profile.phaseVulnerabilityTemplate,
            agent.profile.phaseCrisisTemplate,
            agent.profile.phaseMoneypotTemplate,
            agent.profile.paymentRules,
            agent.profile.safetyRules,
            agent.profile.styleRules
        ].reduce((sum, f) => sum + (f?.length || 0), 0) : 0

        console.log(`\nProfile size: ${profileSize} chars (~${estimateTokens(profileSize.toString(), locale)} profile tokens)`)

        console.log(`\nFull System Prompts by Phase:`)
        console.log('─'.repeat(40))

        for (const phase of phases) {
            try {
                const prompt = await director.buildSystemPrompt(
                    settings,
                    testContact,
                    phase,
                    { trustScore: 50, daysActive: 3 },
                    'Base role prompt here',
                    agent.id,
                    'Test'
                )

                const tokens = estimateTokens(prompt, locale)
                console.log(`   ${phase.padEnd(14)} ${prompt.length.toString().padStart(6)} chars → ~${tokens} tokens`)
            } catch (err: any) {
                console.log(`   ${phase.padEnd(14)} ERROR: ${err.message}`)
            }
        }
    }

    console.log('\n' + '═'.repeat(50))
    console.log('💡 Note: Token estimates use ~4 chars/token (EN) or ~3.5 chars/token (FR)')
    console.log('   Actual token count may vary based on specific tokenizer used.')
    console.log('═'.repeat(50))

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
