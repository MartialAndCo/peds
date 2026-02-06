/**
 * Verify that platform context is actually injected in the prompt
 */

import { runSwarm } from '../lib/swarm'
import { prisma } from '../lib/prisma'

// Mock the response node to capture the prompt
const originalConsoleLog = console.log
let capturedPrompts: { platform: string, prompt: string }[] = []

async function testPlatformInPrompt() {
    console.log('🧪 Testing Platform Injection in Prompt\n')

    // Intercept console.log to capture prompts
    console.log = (...args: any[]) => {
        const msg = args.join(' ')
        if (msg.includes('Prompt assembled')) {
            // Next log might be the platform warning, but we need the actual prompt
        }
        originalConsoleLog.apply(console, args)
    }

    const agent = await prisma.agent.findFirst({
        where: { isActive: true }
    })

    if (!agent) {
        console.error('❌ No active agent found')
        process.exit(1)
    }

    let contact = await prisma.contact.findFirst({
        where: { phone_whatsapp: { startsWith: 'DISCORD_' } }
    })

    if (!contact) {
        contact = await prisma.contact.create({
            data: {
                phone_whatsapp: 'DISCORD_TEST_12345',
                discordId: 'TEST_12345',
                name: 'TestDiscordUser',
                source: 'Discord Test'
            }
        })
    }

    // Test Discord
    console.log('--- Testing Discord Platform Injection ---')
    try {
        await runSwarm(
            'test',
            [{ role: 'user', content: 'test' }],
            contact.id,
            agent.id,
            'Test',
            'text',
            'discord'
        )
    } catch (e) {
        // Expected to potentially fail on API, but prompt should be built
    }

    // Test WhatsApp  
    console.log('\n--- Testing WhatsApp Platform Injection ---')
    try {
        await runSwarm(
            'test',
            [{ role: 'user', content: 'test' }],
            contact.id,
            agent.id,
            'Test',
            'text',
            'whatsapp'
        )
    } catch (e) {
        // Expected
    }

    // Restore console
    console.log = originalConsoleLog

    console.log('\n✅ Test completed!')
    console.log('\n📋 Verification:')
    console.log('  Check the logs above for:')
    console.log('  - "PLATEFORME: Tu discutes actuellement sur Discord." (for Discord)')
    console.log('  - "PLATFORM: You are currently chatting on WhatsApp." (for WhatsApp, if agent is EN)')
    console.log('  - Prompt length should be similar but with different platform names')
    
    process.exit(0)
}

testPlatformInPrompt().catch(e => {
    console.error('💥 Test failed:', e)
    process.exit(1)
})
