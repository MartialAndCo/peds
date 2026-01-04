'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { whatsapp } from '@/lib/whatsapp'

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

export async function sendQueueItemNow(id: string) {
    try {
        const item = await prisma.messageQueue.findUnique({
            where: { id },
            include: { contact: true }
        })

        if (!item || item.status !== 'PENDING') {
            return { success: false, error: 'Item not found or already processed' }
        }

        const { content, contact } = item
        const phone = contact.phone_whatsapp

        // 1. Send Immediately
        // Fix: Mark Read to avoid ghosting blue ticks
        await whatsapp.markAsRead(phone).catch(() => { })

        const fullLength = content.length
        // Realistic Typing for "Send Now" (User wants it faster than natural, but not instant)
        // 40ms/char is fast typing. Min 2s, Max 8s.
        const typingDuration = Math.min(Math.max(fullLength * 40, 2500), 8000)

        // Typing State
        await whatsapp.sendTypingState(phone, true).catch(() => { })

        // ACTUALLY WAIT for the typing duration
        await new Promise(r => setTimeout(r, typingDuration))

        // Send Parts
        let parts = content.split('|||').filter(p => p.trim().length > 0)

        // Fallback: If no ||| separator and text is long, split by newlines (single or double)
        if (parts.length === 1 && content.length > 50) {
            // Split by single newline, but group short lines? 
            // Better: just split by newline for now to avoid walls of text.
            const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0)
            if (paragraphs.length > 1) parts = paragraphs
        }

        for (const part of parts) {
            await whatsapp.sendText(phone, part.trim())
            // Pause between bubbles (Realism)
            if (parts.indexOf(part) < parts.length - 1) {
                await whatsapp.sendTypingState(phone, true).catch(() => { }) // Typings again for next bubble
                await new Promise(r => setTimeout(r, 2000)) // 2s pause
            }
        }

        // 2. Save to History
        await prisma.message.create({
            data: {
                conversationId: item.conversationId,
                sender: 'ai',
                message_text: content.replace(/\|\|\|/g, '\n'),
                timestamp: new Date()
            }
        })

        // 3. Mark as SENT
        await prisma.messageQueue.update({
            where: { id },
            data: { status: 'SENT' }
        })

        revalidatePath('/queue')
        return { success: true }
    } catch (error: any) {
        console.error('Failed to send queue item now:', error)
        return { success: false, error: error.message }
    }
}
