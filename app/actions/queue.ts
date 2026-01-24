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
        await queueService.processedSingleItem(item)

        revalidatePath('/queue')
        return { success: true }
    } catch (error: any) {
        console.error('Failed to send queue item now:', error)
        return { success: false, error: error.message }
    }
}
