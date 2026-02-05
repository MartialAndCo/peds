/**
 * Test que le leadContext est bien injecté dans le prompt système
 */

import { prisma } from '@/lib/prisma'
import { director } from '@/lib/director'
import { settingsService } from '@/lib/settings-cache'

async function testLeadContextInjection() {
    console.log('🧪 Testing leadContext injection in system prompt...\n')

    const TEST_PHONE = '+33600000999'
    const TEST_AGENT_ID = 'cmkvfuyar00004uaximi0hhqw'

    try {
        // 1. Get the contact and conversation
        console.log('📡 Step 1: Loading contact and conversation...')
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: TEST_PHONE }
        })

        if (!contact) {
            console.error('❌ Contact not found! Run test-smart-add-full.ts first')
            process.exit(1)
        }

        const conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                agentId: TEST_AGENT_ID,
                status: 'paused'
            },
            include: { prompt: true }
        })

        if (!conversation) {
            console.error('❌ Conversation not found!')
            process.exit(1)
        }

        console.log('✅ Contact:', contact.name)
        console.log('✅ Conversation:', conversation.id)
        console.log('✅ leadContext in metadata:', (conversation.metadata as any)?.leadContext ? 'YES' : 'NO')

        // 2. Get phase
        console.log('\n📊 Step 2: Getting phase...')
        const { phase, details, reason } = await director.determinePhase(TEST_PHONE, TEST_AGENT_ID)
        console.log(`✅ Phase: ${phase}`)

        // 3. Build system prompt WITH conversation (leadContext injection)
        console.log('\n📝 Step 3: Building system prompt WITH leadContext...')
        const settings = await settingsService.getSettings()
        
        const systemPrompt = await director.buildSystemPrompt(
            settings,
            contact,
            phase,
            details,
            conversation.prompt?.system_prompt || "You are a friend.",
            TEST_AGENT_ID,
            reason,
            undefined,
            conversation // Pass conversation for leadContext injection
        )

        console.log('✅ System prompt built, length:', systemPrompt?.length || 0)

        // 4. Check if leadContext is in the prompt
        console.log('\n🔍 Step 4: Checking leadContext injection...')
        const hasLeadContext = systemPrompt?.includes('IMPORTED') || systemPrompt?.includes('leadContext')
        const hasContinuationInstruction = systemPrompt?.includes('Continue') || systemPrompt?.includes('Reprends')

        console.log(`   Contains IMPORTED marker: ${hasLeadContext ? '✅ YES' : '❌ NO'}`)
        console.log(`   Contains continuation instruction: ${hasContinuationInstruction ? '✅ YES' : '❌ NO'}`)

        // 5. Show relevant excerpt
        if (systemPrompt) {
            const lines = systemPrompt.split('\n')
            let inLeadContext = false
            let excerpt: string[] = []
            
            for (const line of lines) {
                if (line.includes('IMPORTED') || line.includes('🔄')) {
                    inLeadContext = true
                }
                if (inLeadContext) {
                    excerpt.push(line)
                    if (excerpt.length > 15) break
                }
            }

            if (excerpt.length > 0) {
                console.log('\n🎯 LeadContext section in prompt:')
                console.log('─'.repeat(60))
                console.log(excerpt.join('\n'))
                console.log('─'.repeat(60))
            }
        }

        // 6. Summary
        console.log('\n✅ TEST COMPLETE!')
        if (hasLeadContext) {
            console.log('🎉 leadContext is SUCCESSFULLY injected into the system prompt!')
        } else {
            console.log('⚠️ leadContext NOT found in prompt - check director.ts injection logic')
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

testLeadContextInjection()
