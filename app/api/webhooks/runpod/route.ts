
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { whatsapp } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
    logger.info('RunPod TTS Webhook received', { module: 'webhook_runpod' });

    try {
        const payload = await req.json();
        console.log('[RunPod Webhook] Payload:', JSON.stringify(payload, null, 2));

        // Payload structure: { id, status, output: { audio_base64, reference_text, sample_rate } }
        const { id: jobId, status, output } = payload;

        if (status !== 'COMPLETED') {
            logger.warn(`TTS Job ${jobId} status is ${status}`, { module: 'webhook_runpod' } as any);
            return NextResponse.json({ received: true });
        }

        if (!output || !output.audio_base64) {
            logger.error(`TTS Job ${jobId} completed but missing output`, undefined, { module: 'webhook_runpod' });
            return NextResponse.json({ received: true });
        }

        // 1. Check for VoiceGeneration (Playground tests)
        const voiceGeneration = await prisma.voiceGeneration.findFirst({
            where: { jobId: jobId }
        });

        if (voiceGeneration) {
            console.log(`[RunPod Webhook] Found VoiceGeneration ${voiceGeneration.id}`);

            // Save audio to storage
            const { createClient } = require('@supabase/supabase-js');
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            const supabase = createClient(url, key);

            const fileName = `tts_generation_${voiceGeneration.id}_${Date.now()}.wav`;
            const buffer = Buffer.from(output.audio_base64, 'base64');

            const { error: uploadError } = await supabase.storage.from('voice-uploads').upload(fileName, buffer, {
                contentType: 'audio/wav',
                upsert: true
            });

            if (uploadError) {
                console.error('[RunPod Webhook] Storage Upload Failed:', uploadError);
            }

            const { data: publicUrlData } = supabase.storage.from('voice-uploads').getPublicUrl(fileName);
            const publicUrl = publicUrlData?.publicUrl;

            // Update generation record
            await prisma.voiceGeneration.update({
                where: { id: voiceGeneration.id },
                data: {
                    status: 'COMPLETED',
                    audioUrl: publicUrl || `data:audio/wav;base64,${output.audio_base64}`,
                    referenceText: output.reference_text || null
                }
            });

            return NextResponse.json({ success: true });
        }

        // 2. Check for PendingRequest (Voice note for WhatsApp)
        const pendingRequest = await prisma.pendingRequest.findFirst({
            where: { jobId: jobId }
        });

        if (!pendingRequest) {
            logger.warn(`No pending request or generation found for Job ID ${jobId}`, { module: 'webhook_runpod' });
            return NextResponse.json({ received: true });
        }

        console.log(`[RunPod Webhook] Found Pending Request ${pendingRequest.id} for Requester ${pendingRequest.requesterPhone}`);

        // 3. Save Voice Clip
        const { createClient } = require('@supabase/supabase-js');
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(url, key);

        const fileName = `voice_clip_${pendingRequest.id}_${Date.now()}.wav`;
        const buffer = Buffer.from(output.audio_base64, 'base64');

        const { error: uploadError } = await supabase.storage.from('voice-uploads').upload(fileName, buffer, {
            contentType: 'audio/wav',
            upsert: true
        });

        if (uploadError) {
            console.error('[RunPod Webhook] Supabase Upload Failed:', uploadError);
            return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
        }

        const { data: publicUrlData } = supabase.storage.from('voice-uploads').getPublicUrl(fileName);
        const publicUrl = publicUrlData.publicUrl;

        // Create VoiceClip Record
        const transcript = pendingRequest.description || "Voice Note";
        const categoryId = 'general';

        const clip = await prisma.voiceClip.create({
            data: {
                url: publicUrl,
                transcript: transcript,
                duration: 0,
                sentTo: [pendingRequest.requesterPhone],
                categoryId: categoryId
            }
        });

        // 4. Send to Requester
        logger.info(`Sending Generated Voice to ${pendingRequest.requesterPhone}`, { module: 'webhook_runpod' });

        await whatsapp.markAsRead(pendingRequest.requesterPhone).catch(() => { });
        await whatsapp.sendVoice(pendingRequest.requesterPhone, publicUrl);

        // 5. Update Pending Request
        await prisma.pendingRequest.update({
            where: { id: pendingRequest.id },
            data: {
                status: 'fulfilled',
                mediaType: 'audio'
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        const errObj = error instanceof Error ? error : new Error(String(error));
        logger.error('RunPod TTS Webhook Error', errObj, { module: 'webhook_runpod' });
        return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }
}
