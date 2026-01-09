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
                const { content, contact, conversation, mediaUrl, mediaType, duration } = queueItem
                const phone = contact.phone_whatsapp
                const agentId = conversation?.agentId || undefined

                console.log(`[Cron] Sending to ${phone} (ID: ${queueItem.id}), media: ${!!mediaUrl}`)

                // A. HANDLE AUDIO (Voice Notes)
                if (mediaUrl && (mediaType?.startsWith('audio') || mediaUrl.includes('audio/'))) {
                    // Recording Logic
                    await whatsapp.sendRecordingState(phone, true, agentId).catch(e => { })

                    // Use Real Duration (or fallback to heuristic)
                    let audioDurationMs = duration || 5000;
                    if (!duration) {
                        console.warn('[Cron] No duration in DB, using fallback heuristic');
                        if (mediaUrl.startsWith('data:')) {
                            const base64Len = mediaUrl.split(',')[1]?.length || 0;
                            const bytes = base64Len * 0.75;
                            audioDurationMs = Math.min(Math.round(bytes / 12000) * 1000, 20000);
                        } else if (mediaUrl.startsWith('http')) {
                            audioDurationMs = 12000;
                        }
                    }

                    console.log(`[Cron] Audio detected. Mimicking recording for ${audioDurationMs}ms...`)
                    await new Promise(r => setTimeout(r, Math.max(2000, audioDurationMs)))

                    // Send Voice Note
                    await whatsapp.sendVoice(phone, mediaUrl, undefined, agentId)

                    // Stop Recording State
                    await whatsapp.sendRecordingState(phone, false, agentId).catch(e => { })

                    // If there's content (caption), send as follow-up text
                    if (content && content.trim().length > 0) {
                        await new Promise(r => setTimeout(r, 2000))
                        await whatsapp.sendText(phone, content.trim(), undefined, agentId)
                    }
                }
                // B. HANDLE MEDIA (Images/Videos)
                else if (mediaUrl) {
                    await whatsapp.sendTypingState(phone, true, agentId).catch(e => { })
                    const typingMs = Math.min((content?.length || 10) * 60, 5000)
                    await new Promise(r => setTimeout(r, typingMs + 1000))

                    if (mediaType?.includes('video')) {
                        await whatsapp.sendVideo(phone, mediaUrl, content || "", agentId)
                    } else {
                        await whatsapp.sendImage(phone, mediaUrl, content || "", agentId)
                    }
                    await whatsapp.sendTypingState(phone, false, agentId).catch(e => { })
                }
                // C. HANDLE TEXT ONLY
                else {
                    if (!content || content.trim().length === 0) {
                        console.warn(`[Cron] Validation Error: Empty content for QueueItem ${queueItem.id}. Skipping.`)
                        await prisma.messageQueue.update({
                            where: { id: queueItem.id },
                            data: { status: 'INVALID_EMPTY' }
                        })
                        results.push({ id: queueItem.id, status: 'skipped_empty' })
                        continue
                    }

                    await whatsapp.sendTypingState(phone, true, agentId).catch(e => { })
                    const typingMs = Math.min(content.length * 60, 8000)
                    await new Promise(r => setTimeout(r, typingMs + 500))

                    let parts = content.split('|||').filter(p => p.trim().length > 0)
                    if (parts.length === 1 && content.length > 50) {
                        const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0)
                        if (paragraphs.length > 1) parts = paragraphs
                    }

                    for (const part of parts) {
                        await whatsapp.sendText(phone, part.trim(), undefined, agentId)
                        if (parts.indexOf(part) < parts.length - 1) {
                            await new Promise(r => setTimeout(r, 1000))
                        }
                    }
                    await whatsapp.sendTypingState(phone, false, agentId).catch(e => { })
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
