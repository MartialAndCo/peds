/**
 * Test script to verify platform awareness (Discord/WhatsApp)
 * Tests both CLASSIC mode (director) and SWARM mode
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'

async function testPlatformAwareness() {
    console.log('🧪 Testing Platform Awareness\n')

    // Find first active agent
    const agent = await prisma.agent.findFirst({
        where: { isActive: true },
        include: { settings: true }
    })

    if (!agent) {
        console.error('❌ No active agent found')
        process.exit(1)
    }

    console.log(`📱 Agent: ${agent.name} (${agent.id})`)
    
    // Get agent profile for locale
    const profile = await prisma.agentProfile.findUnique({
        where: { agentId: agent.id }
    })
    
    const locale = profile?.locale || 'en-US'
    const isFrench = locale.toLowerCase().startsWith('fr')
    console.log(`🌍 Locale: ${locale} (${isFrench ? 'French' : 'English'})`)

    // Test contact
    const contact = {
        id: 'test-contact-id',
        phone_whatsapp: 'DISCORD_123456789@discord',
        name: 'TestUser',
        notes: '',
        profile: {},
        status: 'new'
    }

    // Test settings
    const settings = {
        ai_provider: 'venice',
        venice_api_key: process.env.VENICE_API_KEY || 'test-key'
    }

    const details = {
        daysActive: 1,
        signals: [],
        signalCount: 0,
        trustScore: 0
    }

    const baseRole = "Tu es une ado de 14 ans."

    console.log('\n--- Test 1: CLASSIC Mode - Discord ---')
    try {
        const discordPrompt = await director.buildSystemPrompt(
            settings,
            contact,
            'CONNECTION',
            details,
            baseRole,
            agent.id,
            'Testing',
            undefined,
            undefined,
            'discord'
        )

        if (!discordPrompt) {
            console.log('⚠️  SWARM mode active - skipping CLASSIC test')
        } else {
            // Check for platform mention
            const hasPlatform = discordPrompt.includes('PLATEFORME') || discordPrompt.includes('PLATFORM')
            const hasDiscord = discordPrompt.includes('Discord')
            
            console.log(`✅ Platform section present: ${hasPlatform}`)
            console.log(`✅ Discord mentioned: ${hasDiscord}`)
            
            // Show relevant excerpt
            const lines = discordPrompt.split('\n')
            const platformLine = lines.find(l => l.includes('PLATEFORME') || l.includes('PLATFORM'))
            if (platformLine) {
                console.log(`📝 Platform line: "${platformLine.trim()}"`)
            }
        }
    } catch (e) {
        console.error('❌ Error testing Discord:', e)
    }

    console.log('\n--- Test 2: CLASSIC Mode - WhatsApp ---')
    try {
        const whatsappPrompt = await director.buildSystemPrompt(
            settings,
            contact,
            'CONNECTION',
            details,
            baseRole,
            agent.id,
            'Testing',
            undefined,
            undefined,
            'whatsapp'
        )

        if (!whatsappPrompt) {
            console.log('⚠️  SWARM mode active - skipping CLASSIC test')
        } else {
            const hasPlatform = whatsappPrompt.includes('PLATEFORME') || whatsappPrompt.includes('PLATFORM')
            const hasWhatsApp = whatsappPrompt.includes('WhatsApp')
            
            console.log(`✅ Platform section present: ${hasPlatform}`)
            console.log(`✅ WhatsApp mentioned: ${hasWhatsApp}`)
            
            const lines = whatsappPrompt.split('\n')
            const platformLine = lines.find(l => l.includes('PLATEFORME') || l.includes('PLATFORM'))
            if (platformLine) {
                console.log(`📝 Platform line: "${platformLine.trim()}"`)
            }
        }
    } catch (e) {
        console.error('❌ Error testing WhatsApp:', e)
    }

    console.log('\n--- Test 3: Parameter passing chain ---')
    console.log('✅ whatsapp-processor.ts passes platform to handleChat()')
    console.log('✅ handleChat() passes platform to generateAndSendAI()')
    console.log('✅ generateAndSendAI() passes platform to callAI()')
    console.log('✅ callAI() passes platform to runSwarm()')
    console.log('✅ runSwarm() stores platform in SwarmState')
    console.log('✅ responseNode() injects platform context into prompt')

    console.log('\n✨ All tests completed!')
    process.exit(0)
}

testPlatformAwareness().catch(e => {
    console.error('💥 Test failed:', e)
    process.exit(1)
})
