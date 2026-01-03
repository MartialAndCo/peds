'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getQueueItems() {
    try {
        const items = await prisma.messageQueue.findMany({
            where: {
                status: 'PENDING'
            },
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
