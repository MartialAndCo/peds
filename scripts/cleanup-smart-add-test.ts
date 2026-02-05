/**
 * Cleanup script for Smart Add test data
 */

import { prisma } from '@/lib/prisma'
import { memoryService } from '@/lib/memory'

async function cleanup() {
    const TEST_PHONE = '+33600000999'
    const TEST_AGENT_ID = 'cmkvfuyar00004uaximi0hhqw'

    console.log('🧹 Cleaning up Smart Add test data...\n')

    try {
        // 1. Find contact
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: TEST_PHONE }
        })

        if (contact) {
            // 2. Delete conversations
            const deletedConvs = await prisma.conversation.deleteMany({
                where: { contactId: contact.id }
            })
            console.log(`✅ Deleted ${deletedConvs.count} conversations`)

            // 3. Delete AgentContact
            const deletedAgentContact = await prisma.agentContact.deleteMany({
                where: { contactId: contact.id }
            })
            console.log(`✅ Deleted ${deletedAgentContact.count} AgentContact bindings`)

            // 4. Delete messages
            const deletedMessages = await prisma.message.deleteMany({
                where: { conversation: { contactId: contact.id } }
            })
            console.log(`✅ Deleted ${deletedMessages.count} messages`)

            // 5. Delete contact
            await prisma.contact.delete({
                where: { id: contact.id }
            })
            console.log(`✅ Deleted contact ${contact.id}`)
        }

        // 6. Clean Mem0 memories
        const userId = memoryService.buildUserId(TEST_PHONE, TEST_AGENT_ID)
        await memoryService.deleteAll(userId)
        console.log(`✅ Deleted Mem0 memories for ${userId}`)

        console.log('\n✅ Cleanup complete!')

    } catch (error) {
        console.error('❌ Cleanup failed:', error)
    }
}

cleanup()
