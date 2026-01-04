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

        console.log('[Cron] Processing Message Queue...')

        // 1. Find Pending Messages due NOW (or in the past)
        const pendingMessages = await prisma.messageQueue.findMany({
            where: {
                status: 'PENDING',
                scheduledAt: {
                    lte: new Date() // Due now or before
                }
            },
            include: {
                contact: true
            },
            take: 50 // Process in batches to avoid timeout
        })

        console.log(`[Cron] Found ${pendingMessages.length} pending messages.`)

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
                const { content, contact } = queueItem
                const phone = contact.phone_whatsapp

                console.log(`[Cron] Sending to ${phone} (ID: ${queueItem.id})`)

                // Mark Read if not already (Just in case logic: Ensure it's read before reply)
                await whatsapp.markAsRead(phone).catch(e => { })

                // Typing Logic (Simulated)
                // Non-blocking simulated typing state (just fire and forget, don't await long duration)
                await whatsapp.sendTypingState(phone, true).catch(e => { })

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
                    await whatsapp.sendText(phone, part.trim())
                    if (parts.indexOf(part) < parts.length - 1) {
                        await new Promise(r => setTimeout(r, 1000)) // Short pause
                    }
                }

                // 3. Save to Messages Table (Actual History)
                // Note: The Webhook queue logic did NOT save to 'Message' table yet.
                // It only queued it. Now we save it as a real sent message.

                // Wait, webhook generated it but didn't save to 'Message'. Correct.
                // We need conversationId.
                await prisma.message.create({
                    data: {
                        conversationId: queueItem.conversationId,
                        sender: 'ai',
                        message_text: content.replace(/\|\|\|/g, '\n'),
                        timestamp: new Date()
                    }
                })

                // 4. Update Queue Status
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
