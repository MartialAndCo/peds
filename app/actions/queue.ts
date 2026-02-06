'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { whatsapp } from '@/lib/whatsapp'
import { queueService } from '@/lib/services/queue-service'

export async function getQueueItems(agentId?: string) {
    try {
        const where: any = {
            status: 'PENDING'
        }

        if (agentId) {
            where.conversation = {
                agentId: agentId
            }
        }

        const items = await prisma.messageQueue.findMany({
            where,
            include: {
                contact: {
                    select: {
                        name: true,
                        phone_whatsapp: true,
                        id: true
                    }
                }
            },
            orderBy: {
                scheduledAt: 'asc'
            }
        })

        // Serialize dates for Client Components
        return items.map(item => ({
            ...item,
            scheduledAt: item.scheduledAt.toISOString(),
            createdAt: item.createdAt.toISOString()
        }))
    } catch (error) {
        console.error('Failed to fetch queue:', error)
        return []
    }
}

export async function deleteQueueItem(id: string) {
    try {
        await prisma.messageQueue.delete({
            where: { id }
        })
        revalidatePath('/queue')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete queue item:', error)
        return { success: false, error: 'Failed' }
    }
}

// ...

// ...

export async function sendQueueItemNow(id: string) {
    try {
        const item = await prisma.messageQueue.findUnique({
            where: { id },
            include: { contact: true, conversation: true }
        })

        if (!item || item.status !== 'PENDING') {
            return { success: false, error: 'Item not found or already processed' }
        }

        // Use the shared service logic
        await queueService.processSingleItem(item)

        revalidatePath('/queue')
        return { success: true }
    } catch (error: any) {
        console.error('Failed to send queue item now:', error)
        return { success: false, error: error.message }
    }
}

export async function clearAllQueues() {
    try {
        console.log('🧹 Starting cleanup of message queues via Server Action...')

        // 1. Clear Incoming Queue (Webhooks waiting to be processed)
        const deletedIncoming = await prisma.incomingQueue.deleteMany({})

        // 2. Clear Outgoing Message Queue (Messages waiting to be sent)
        const deletedOutgoing = await prisma.messageQueue.deleteMany({})

        // 3. Clear Webhook Events (Raw events log)
        const deletedWebhooks = await prisma.webhookEvent.deleteMany({})

        // 4. Clear Pending Voice Generations
        const deletedVoice = await prisma.voiceGeneration.deleteMany({
            where: { status: 'PENDING' }
        })

        console.log(`✅ Cleanup complete: ${deletedIncoming.count} incoming, ${deletedOutgoing.count} outgoing, ${deletedWebhooks.count} webhooks, ${deletedVoice.count} voice.`)

        revalidatePath('/queue')
        revalidatePath('/admin/dashboard')
        revalidatePath('/admin/settings')

        return {
            success: true,
            counts: {
                incoming: deletedIncoming.count,
                outgoing: deletedOutgoing.count,
                webhooks: deletedWebhooks.count,
                voice: deletedVoice.count
            }
        }
    } catch (error: any) {
        console.error('❌ Error during queue cleanup:', error)
        return { success: false, error: error.message }
    }
}
