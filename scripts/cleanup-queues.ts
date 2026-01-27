import { prisma } from '../lib/prisma'

async function cleanupQueues() {
    console.log('🧹 Starting cleanup of message queues...')

    try {
        // 1. Clear Incoming Queue (Webhooks waiting to be processed)
        const deletedIncoming = await prisma.incomingQueue.deleteMany({})
        console.log(`✅ Deleted ${deletedIncoming.count} items from IncomingQueue`)

        // 2. Clear Outgoing Message Queue (Messages waiting to be sent)
        const deletedOutgoing = await prisma.messageQueue.deleteMany({})
        console.log(`✅ Deleted ${deletedOutgoing.count} items from MessageQueue`)

        // 3. Clear Webhook Events (Raw events log)
        const deletedWebhooks = await prisma.webhookEvent.deleteMany({})
        console.log(`✅ Deleted ${deletedWebhooks.count} items from WebhookEvent`)

        // 4. Clear pending voice generations? (Optional, but safe if "resetting from 0")
        const deletedVoice = await prisma.voiceGeneration.deleteMany({
            where: { status: 'PENDING' }
        })
        console.log(`✅ Deleted ${deletedVoice.count} pending VoiceGenerations`)

        console.log('✨ Cleanup complete!')
    } catch (error) {
        console.error('❌ Error during cleanup:', error)
    } finally {
        await prisma.$disconnect()
    }
}

cleanupQueues()
