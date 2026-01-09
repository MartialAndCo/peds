
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rvcService } from '@/lib/rvc';
import { mediaService } from '@/lib/media';
import { anthropic } from '@/lib/anthropic';
import { venice } from '@/lib/venice';

const DEFAULT_VOICE_CHECK_PROMPT = `
You are an intelligent assistant managing a WhatsApp conversation.
A voice note was requested with this description: "{REQUEST_DESCRIPTION}".
It is now ready to send.
However, the user has sent new messages since the request was made:
{NEW_MESSAGES}

Analyze if the voice note is still relevant.
- If the user explicitly cancelled the request, reply "CANCEL".
- If the user completely changed the topic and the voice note would be weird, reply "RETRY" (to ask the source to record again).
- In ALMOST ALL OTHER CASES, including if the user is just chatting, reply "SEND".

Reply ONLY with one word: SEND, CANCEL, or RETRY.
`;

export async function GET(req: Request) {
    try {
        // 1. Find Processing Requests
        const processingRequests = await prisma.pendingRequest.findMany({
            where: {
                status: 'processing',
                jobId: { not: null }
            },
            take: 5 // Process a few at a time
        });

        if (processingRequests.length === 0) {
            return NextResponse.json({ processed: 0, msg: 'No active jobs' });
        }

        const results = [];

        for (const req of processingRequests) {
            const jobId = req.jobId!;
            console.log(`[VoiceCron] Checking Job ${jobId} for ${req.requesterPhone}`);

            try {
                // 2. Check RunPod
                const status = await rvcService.checkJob(jobId);

                if (status.status === 'COMPLETED' && status.output) {
                    // Success!
                    let finalUrl = status.output.audio_url;

                    // If output is base64 (older behavior or small file), convert to data URI
                    if (!finalUrl && status.output.audio_base64) {
                        finalUrl = `data:audio/wav;base64,${status.output.audio_base64}`;
                    }

                    if (!finalUrl && status.output.message) {
                        // Sometimes RunPod returns message on success? No...
                        // If url is missing but status completed, something is wrong.
                        throw new Error("Completed but no audio output found.");
                    }

                    // --- CONTEXT SAFETY CHECK ---
                    let decision = 'SEND';
                    try {
                        const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: req.requesterPhone } });
                        if (contact) {
                            const conversation = await prisma.conversation.findFirst({
                                where: { contactId: contact.id, status: { in: ['active', 'paused'] } },
                                orderBy: { createdAt: 'desc' }
                            });

                            if (conversation) {
                                const newMessages = await prisma.message.findMany({
                                    where: {
                                        conversationId: conversation.id,
                                        sender: 'contact',
                                        timestamp: { gt: req.createdAt } // Check messages sent since request
                                    },
                                    orderBy: { timestamp: 'asc' }
                                });

                                if (newMessages.length > 0) {
                                    console.log(`[VoiceCron] Found ${newMessages.length} new messages. Checking context...`);
                                    const settingsList = await prisma.setting.findMany();
                                    const settings = settingsList.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc }, {});

                                    const provider = settings.ai_provider || 'venice';
                                    const messagesLog = newMessages.map(m => `[User]: ${m.message_text}`).join('\n');
                                    const promptTemplate = settings.prompt_voice_context_check || DEFAULT_VOICE_CHECK_PROMPT;
                                    const prompt = promptTemplate
                                        .replace('{REQUEST_DESCRIPTION}', req.description)
                                        .replace('{NEW_MESSAGES}', messagesLog);

                                    let aiResponse = "SEND";
                                    if (provider === 'anthropic') {
                                        aiResponse = await anthropic.chatCompletion("You are a controller.", [], prompt, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model });
                                    } else {
                                        aiResponse = await venice.chatCompletion("You are a controller.", [], prompt, { apiKey: settings.venice_api_key, model: settings.venice_model });
                                    }

                                    const cleanResponse = aiResponse.trim().toUpperCase().replace(/[^A-Z]/g, '');
                                    if (cleanResponse.includes('CANCEL')) decision = 'CANCEL';
                                    else if (cleanResponse.includes('RETRY')) decision = 'RETRY';
                                }
                            }
                        }
                    } catch (aiErr) {
                        console.error("[VoiceCron] AI Context Check failed, defaulting to SEND:", aiErr);
                    }

                    if (decision === 'CANCEL') {
                        console.log(`[VoiceCron] AI cancelled delivery for ${req.requesterPhone} due to context change.`);
                        await prisma.pendingRequest.update({ where: { id: req.id }, data: { status: 'cancelled' } });
                        results.push({ id: req.id, status: 'cancelled_by_ai' });
                        continue;
                    }

                    if (decision === 'RETRY') {
                        console.log(`[VoiceCron] AI requested RETRY for ${req.requesterPhone}.`);
                        await prisma.pendingRequest.update({ where: { id: req.id }, data: { status: 'failed', description: `RETRY requested due to context: ${req.description}` } });
                        results.push({ id: req.id, status: 'retry_requested_by_ai' });
                        continue;
                    }

                    console.log(`[VoiceCron] Job Done. Creating VoiceClip & Re-injecting...`);

                    // Extract Audio Duration
                    let audioDurationMs = null;
                    try {
                        const { parseBuffer } = await import('music-metadata');
                        let buffer: Buffer;

                        if (finalUrl.startsWith('data:')) {
                            const base64Data = finalUrl.split(',')[1] || finalUrl;
                            buffer = Buffer.from(base64Data, 'base64');
                        } else {
                            const response = await fetch(finalUrl);
                            const arrayBuffer = await response.arrayBuffer();
                            buffer = Buffer.from(arrayBuffer);
                        }

                        const metadata = await parseBuffer(buffer, { mimeType: 'audio/mpeg' });
                        if (metadata.format.duration) {
                            audioDurationMs = Math.round(metadata.format.duration * 1000);
                            console.log(`[VoiceCron] Extracted audio duration: ${audioDurationMs}ms`);
                        }
                    } catch (metaErr) {
                        console.warn('[VoiceCron] Failed to extract audio duration:', metaErr);
                    }

                    // A. Create VoiceClip (For Reusability/Bank)
                    let categoryId = 'general';
                    try {
                        const generalCat = await prisma.voiceCategory.findFirst({ where: { id: 'general' } });
                        if (!generalCat) await prisma.voiceCategory.create({ data: { id: 'general', description: 'General' } });
                    } catch (e) { }

                    await prisma.voiceClip.create({
                        data: {
                            categoryId: categoryId,
                            url: finalUrl,
                            transcript: req.description || "Audio Response",
                            sourcePhone: "AI_RVC",
                            sentTo: [req.requesterPhone],
                            duration: audioDurationMs
                        }
                    });

                    // B. Re-Inject into Media Flow for Delivery
                    const ingestionResult = {
                        sentTo: req.requesterPhone,
                        type: req.typeId || 'voice_note',
                        mediaUrl: finalUrl,
                        mediaType: 'audio/wav',
                        duration: audioDurationMs
                    };

                    console.log(`[VoiceCron] Job Done. Re-injecting to Admin Media Flow...`);

                    // Reuse existing logic (Scheduling, Captioning, Sending)
                    await mediaService.processAdminMedia(
                        'AI_GENERATED', // "Source" is AI
                        ingestionResult
                    );

                    // 4. Mark Fulfilled
                    await prisma.pendingRequest.update({
                        where: { id: req.id },
                        data: { status: 'fulfilled' }
                    });

                    results.push({ id: req.id, status: 'completed' });

                } else if (status.status === 'FAILED' || status.status === 'TIMED_OUT') {
                    console.error(`[VoiceCron] Job Failed: ${status.error}`);
                    await prisma.pendingRequest.update({
                        where: { id: req.id },
                        data: { status: 'failed', description: `Failed: ${status.error}` }
                    });
                    results.push({ id: req.id, status: 'failed' });
                } else {
                    // Still running
                    results.push({ id: req.id, status: 'running' });
                }

            } catch (err: any) {
                console.error(`[VoiceCron] Error processing ${req.id}:`, err);
                results.push({ id: req.id, error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('[VoiceCron] Fatal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
