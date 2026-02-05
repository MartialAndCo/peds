/**
 * Test que le SWARM reçoit bien le leadContext
 */

import { prisma } from '@/lib/prisma'
import { runSwarm } from '@/lib/swarm'

async function testSwarmLeadContext() {
    console.log('🧪 Testing SWARM leadContext integration...\n')

    const TEST_PHONE = '+33600000999'
    const TEST_AGENT_ID = 'cmkvfuyar00004uaximi0hhqw'

    try {
        // 1. Get contact
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: TEST_PHONE }
        })

        if (!contact) {
            console.error('❌ Contact not found! Run test-smart-add-full.ts first')
            process.exit(1)
        }

        console.log('✅ Contact:', contact.name, `(${contact.id})`)

        // 2. Get conversation to check leadContext
        const conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                agentId: TEST_AGENT_ID
            }
        })

        if (!conversation) {
            console.error('❌ Conversation not found!')
            process.exit(1)
        }

        const metadata = conversation.metadata as any
        console.log('✅ Conversation:', conversation.id)
        console.log('✅ leadContext stored:', metadata?.leadContext ? 'YES' : 'NO')
        console.log('✅ Platform:', metadata?.platform || 'unknown')

        if (metadata?.leadContext) {
            console.log('\n📝 Stored leadContext:')
            console.log('─'.repeat(60))
            console.log(metadata.leadContext.substring(0, 200) + '...')
            console.log('─'.repeat(60))
        }

        // 3. Test SWARM execution
        console.log('\n🤖 Step 3: Testing SWARM execution...')
        console.log('   Sending test message: "hey ça va ?"')
        
        const response = await runSwarm(
            "hey ça va ?",
            [], // no history
            contact.id,
            TEST_AGENT_ID,
            contact.name || 'User',
            'text'
        )

        console.log('\n✅ SWARM response:')
        console.log('─'.repeat(60))
        console.log(response)
        console.log('─'.repeat(60))

        // 4. Analyze response
        console.log('\n🔍 Step 4: Analyzing response...')
        const isNaturalContinuation = !response.toLowerCase().includes('salut') && 
                                       !response.toLowerCase().includes('bonjour') &&
                                       !response.toLowerCase().includes('hey') &&
                                       !response.toLowerCase().includes('coucou')
        
        if (isNaturalContinuation) {
            console.log('✅ Response looks like a natural continuation (no greeting)')
        } else {
            console.log('⚠️ Response contains greeting - might not be using leadContext')
        }

        console.log('\n✅ TEST COMPLETE!')
        console.log('\n💡 Note: The leadContext should make the AI continue the conversation')
        console.log('   naturally as if it already knows Marc (17 ans, Lyon, foot)...')

    } catch (error) {
        console.error('\n❌ Test failed:', error)
    } finally {
        await prisma.$disconnect()
    }
}

testSwarmLeadContext()
