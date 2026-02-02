import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processWhatsAppPayload } from '@/lib/services/whatsapp-processor'
import { logger, trace } from '@/lib/logger'
import { runpod } from '@/lib/runpod'
import { whatsapp } from '@/lib/whatsapp'

// Allow up to 300 seconds (5 mins) for AI processing - Max for most serverless functions
export const maxDuration = 300

/**
 * CRON Endpoint: Process Incoming Message Queue
 * Supports Async AI Jobs (RunPod) to avoid timeouts.
 */
export async function GET(req: Request) {
    try {
        console.log('[CRON] Processing incoming message queue...')
        let processed = 0
        let stillProcessing = 0

        // --- PART 1: Process NEW Messages (PENDING) ---
        // ATOMIC CLAIM: Use transaction to prevent race conditions
        // This ensures only ONE CRON invocation can claim each item.
        // --- PART 1: Process NEW Messages (PENDING) ---
        // ATOMIC CLAIM: Use transaction to prevent race conditions
        // This ensures only ONE CRON invocation can claim each item.
        const pending = await prisma.$transaction(async (tx) => {
            // Find items that are ready - Take larger batch for bursts
            // IMPORTANT: We must order by createdAt ASC to process in order
            const items = await tx.incomingQueue.findMany({
                where: { status: 'PENDING' },
                take: 50, // Increased from 5 to 50 to capture bursts
                orderBy: { createdAt: 'asc' }
            })

            // Immediately lock ALL of them
            if (items.length > 0) {
                await tx.incomingQueue.updateMany({
                    where: { id: { in: items.map(i => i.id) } },
                    data: { status: 'PROCESSING' }
                })
            }

            return items
        })

        // Group by Sender + AgentId (Burst logic)
        const bursts = new Map<string, typeof pending>();

        for (const item of pending) {
            const payload = item.payload as any;
            // Identify sender key: AgentId + RemoteJid
            // If from is missing, fallback to unique ID to treat as isolated
            const from = payload.payload?.from || `unknown_${item.id}`;
            const senderKey = `${item.agentId}:${from}`;

            if (!bursts.has(senderKey)) bursts.set(senderKey, []);
            bursts.get(senderKey)!.push(item);
        }

        // Process each burst
        for (const [key, items] of bursts.entries()) {
            if (items.length > 1) {
                console.log(`[CRON] Burst detected for ${key}: ${items.length} messages`)
            } else {
                // No debug logging for single items
            }

            let lastResponse: string | undefined = undefined; // Track last AI response for this burst

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const isLast = i === items.length - 1;

                // Skip AI for all items EXCEPT the last one in the burst.
                // This ensures all messages are saved to DB context (preserving history),
                // but only one AI response is triggered at the end.
                const skipAI = !isLast;

                try {
                    const payload = item.payload as any
                    const traceId = trace.generate()

                    // Execute Logic with skipAI option AND previous response context
                    const result = await trace.runAsync(traceId, item.agentId as unknown as string, async () => {
                        return await processWhatsAppPayload(payload.payload, item.agentId as unknown as string, {
                            skipAI,
                            previousResponse: lastResponse // Pass the memory
                        })
                    })

                    // Capture response for next iteration if AI generated something
                    if (result?.status === 'sent' && result?.textBody) {
                        lastResponse = result.textBody
                    }

                    // Check Result
                    if (result?.status === 'async_job_started' && result?.jobId) {
                        // Switch to Async Mode
                        console.log(`[CRON] Item ${item.id} switched to Async Job: ${result.jobId}`)
                        await prisma.incomingQueue.update({
                            where: { id: item.id },
                            data: {
                                status: 'AI_PROCESSING',
                                runpodJobId: result.jobId
                            }
                        })
                    } else {
                        // Regular Completion
                        await prisma.incomingQueue.update({
                            where: { id: item.id },
                            data: { status: 'DONE', processedAt: new Date() }
                        })
                        processed++
                    }

                } catch (err: any) {
                    console.error(`[CRON] Failed item ${item.id}:`, err)
                    await prisma.incomingQueue.update({
                        where: { id: item.id },
                        data: {
                            status: item.attempts >= 2 ? 'FAILED' : 'PENDING',
                            attempts: { increment: 1 },
                            error: err.message
                        }
                    })
                }
            }
        }

        // --- PART 2: Poll Async Jobs (AI_PROCESSING) ---
        const asyncJobs = await prisma.incomingQueue.findMany({
            where: { status: 'AI_PROCESSING', runpodJobId: { not: null } },
            take: 10
        })

        for (const job of asyncJobs) {
            if (!job.runpodJobId) continue

            try {
                const check = await runpod.checkJobStatus(job.runpodJobId)

                if (check.status === 'COMPLETED' && check.output) {
                    console.log(`[CRON] Async Job ${job.runpodJobId} COMPLETED. Finalizing...`)
                    const responseText = check.output

                    // 1. Save to DB (Find conversation logic is tricky here as we lost context)
                    // We need to re-find the conversation. Ideally we stored convId in queue, but we didn't add the column yet.
                    // We'll assume the last active conversation for this contact.

                    const payload = job.payload as any
                    const from = payload.payload?.from || ""
                    // Normalize phone (reuse logic roughly)
                    const phone = from.includes('@') ? `+${from.split('@')[0]}` : ""

                    if (phone) {
                        // Send WhatsApp Response
                        await whatsapp.sendText(phone, responseText, undefined, job.agentId as unknown as string)

                        // Try to log it if we can find the conv
                        const conv = await prisma.conversation.findFirst({
                            where: { contact: { phone_whatsapp: phone }, status: { in: ['active', 'paused'] } },
                            orderBy: { updatedAt: 'desc' }
                        })
                        if (conv) {
                            await prisma.message.create({
                                data: {
                                    conversationId: conv.id,
                                    sender: 'ai',
                                    message_text: responseText,
                                    timestamp: new Date()
                                }
                            })
                        }
                    }

                    // Mark DONE
                    await prisma.incomingQueue.update({
                        where: { id: job.id },
                        data: { status: 'DONE', processedAt: new Date() }
                    })
                    processed++

                } else if (check.status === 'FAILED' || check.status === 'CANCELLED') {
                    console.error(`[CRON] Async Job ${job.runpodJobId} FAILED.`)
                    await prisma.incomingQueue.update({
                        where: { id: job.id },
                        data: { status: 'FAILED', error: 'Async Job Failed' }
                    })
                } else {
                    // IN_QUEUE or IN_PROGRESS
                    console.log(`[CRON] Async Job ${job.runpodJobId} still running...`)
                    stillProcessing++
                }

            } catch (e: any) {
                console.error(`[CRON] Error polling job ${job.id}:`, e.message)
            }
        }

        return NextResponse.json({
            success: true,
            processed,
            stillProcessing,
            checked: pending.length + asyncJobs.length
        })

    } catch (error: any) {
        console.error('[CRON] Fatal error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
