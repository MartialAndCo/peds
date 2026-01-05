import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'

// This route should be triggered by Vercel Cron (e.g., every 10 mins)
export async function GET(req: Request) {
    try {
        // Authenticate Cron (Optional but recommended)
        // const authHeader = req.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new Response('Unauthorized', { status: 401 });
        // }

        const now = new Date()
        console.log(`[Cron] Processing Message Queue... Server time: ${now.toISOString()}`)

        // Debug: Count ALL pending messages (even future ones)
        const allPending = await prisma.messageQueue.count({
            where: { status: 'PENDING' }
        })
        console.log(`[Cron] Total PENDING messages (all): ${allPending}`)

        // 1. Find Pending Messages due NOW (or in the past)
        const pendingMessages = await prisma.messageQueue.findMany({
            where: {
                status: 'PENDING',
                scheduledAt: {
                    lte: now // Due now or before
                }
            },
            include: {
                contact: true,
                conversation: true
            },
            take: 50 // Process in batches to avoid timeout
        })

        console.log(`[Cron] Found ${pendingMessages.length} pending messages DUE NOW.`)

        // Log the first few scheduled times for debugging
        if (allPending > 0 && pendingMessages.length === 0) {
            const nextPending = await prisma.messageQueue.findFirst({
                where: { status: 'PENDING' },
                orderBy: { scheduledAt: 'asc' }
            })
            if (nextPending) {
                console.log(`[Cron] Next scheduled message at: ${nextPending.scheduledAt?.toISOString()} (in ${Math.round((nextPending.scheduledAt!.getTime() - now.getTime()) / 1000)}s)`)
            }
        }

        if (pendingMessages.length === 0) {
            return NextResponse.json({ success: true, processed: 0 })
        }

        const results = []

        for (const queueItem of pendingMessages) {
            try {
                // Lock item (Optimistic locking or just update status to PROCESSING?)
                // Simple approach: Update to SENT immediately after sending.
                // Or update to 'PROCESSING' first if we worry about parallel crons (Vercel cron is usually unique if schedule is sparse)

                // 2. Processing
                const { content, contact, conversation } = queueItem
                const phone = contact.phone_whatsapp
                const agentId = conversation?.agentId || undefined // Multi-Session Support (null -> undefined)

                console.log(`[Cron] Sending to ${phone} (ID: ${queueItem.id})`)

                // GUARD: Check for empty content (prevent empty bubbles)
                if (!content || content.trim().length === 0) {
                    console.warn(`[Cron] Validation Error: Empty content for QueueItem ${queueItem.id}. Skipping.`)
                    await prisma.messageQueue.update({
                        where: { id: queueItem.id },
                        data: { status: 'INVALID_EMPTY' } // Custom status or FAILED
                    })
                    results.push({ id: queueItem.id, status: 'skipped_empty' })
                    continue
                }

                // Mark Read if not already (Just in case logic: Ensure it's read before reply)
                await whatsapp.markAsRead(phone, agentId).catch(e => { })

                // Typing Logic (Simulated)
                // Non-blocking simulated typing state (just fire and forget, don't await long duration)
                await whatsapp.sendTypingState(phone, true, agentId).catch(e => { })

                // REALISTIC Typing (Cron can afford a few seconds now that batch is 50 and we process efficiently)
                // 50-80ms per char is human-like.
                // Cap at 8-10s to avoid holding the worker too long.
                const typingMs = Math.min(content.length * 60, 8000)
                await new Promise(r => setTimeout(r, typingMs + 500)) // +500ms base delay

                // Send Text
                // Check if we need to split (cron splits if needed, but webhook usually generated clean text or |||)
                let parts = content.split('|||').filter(p => p.trim().length > 0)

                // Fallback: Splitting by newlines if big block
                if (parts.length === 1 && content.length > 50) {
                    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0)
                    if (paragraphs.length > 1) parts = paragraphs
                }

                for (const part of parts) {
                    await whatsapp.sendText(phone, part.trim(), undefined, agentId)
                    if (parts.indexOf(part) < parts.length - 1) {
                        await new Promise(r => setTimeout(r, 1000)) // Short pause
                    }
                }

                // NOTE: Message is already saved to Message table by the chat handler
                // that queued it. We just need to update the queue status.

                // 3. Update Queue Status
                await prisma.messageQueue.update({
                    where: { id: queueItem.id },
                    data: { status: 'SENT' }
                })

                results.push({ id: queueItem.id, status: 'success' })

            } catch (error: any) {
                console.error(`[Cron] Failed to process item ${queueItem.id}:`, error)
                await prisma.messageQueue.update({
                    where: { id: queueItem.id },
                    data: {
                        status: 'FAILED',
                        attempts: { increment: 1 }
                    }
                })
                results.push({ id: queueItem.id, status: 'error', error: error.message })
            }
        }

        return NextResponse.json({ success: true, results })

    } catch (error: any) {
        console.error('[Cron] Fatal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
