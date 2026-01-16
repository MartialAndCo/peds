
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { whatsapp } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
    logger.info('RunPod Webhook received', { module: 'webhook_runpod' });

    try {
        const payload = await req.json();
        console.log('[RunPod Webhook] Payload:', JSON.stringify(payload, null, 2));

        // Payload structure: { id, status, output: { audio_base64, ... } }
        const { id: jobId, status, output } = payload;

        if (status !== 'COMPLETED') {
            logger.warn(`RunPod Job ${jobId} status is ${status}`, { module: 'webhook_runpod' } as any);
            return NextResponse.json({ received: true });
        }

        if (!output || !output.audio_base64) {
            logger.error(`RunPod Job ${jobId} completed but missing output`, { module: 'webhook_runpod' });
            return NextResponse.json({ received: true });
        }

        // 1. Find the Pending Request
        const pendingRequest = await prisma.pendingRequest.findFirst({
            where: { jobId: jobId }
        });

        if (!pendingRequest) {
            logger.warn(`No pending request found for Job ID ${jobId}`, { module: 'webhook_runpod' });
            return NextResponse.json({ received: true });
        }

        console.log(`[RunPod Webhook] Found Pending Request ${pendingRequest.id} for Requester ${pendingRequest.requesterPhone}`);

        // 2. Save Voice Clip
        const { createClient } = require('@supabase/supabase-js');
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(url, key);

        const fileName = `voice_clip_${pendingRequest.id}_${Date.now()}.mp3`;
        const buffer = Buffer.from(output.audio_base64, 'base64');

        const { error: uploadError } = await supabase.storage.from('voice-uploads').upload(fileName, buffer, {
            contentType: 'audio/mpeg',
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

        // Ensure 'general' category exists or fallback
        // We will just use 'general' for now.
        const categoryId = 'general';

        // Upsert category just in case? No, simpler to just use it.
        // Prisma will error if not found.
        // We'll create it if missing to be safe (upsert pattern) if we could.
        // But for now, let's assume 'general' exists as per seed.

        // Fix: logger.error signature (message, object, context)
        // logger.error('RunPod Webhook Error', error, { module: 'webhook_runpod' });

        const clip = await prisma.voiceClip.create({
            data: {
                url: publicUrl,
                transcript: transcript,
                duration: 0, // Unknown
                sentTo: [pendingRequest.requesterPhone],
                categoryId: categoryId
            }
        });

        // 3. Send to Requester
        logger.info(`Sending Converted Voice to ${pendingRequest.requesterPhone}`, { module: 'webhook_runpod' });

        // Mark as read first
        await whatsapp.markAsRead(pendingRequest.requesterPhone).catch(() => { });

        // Send Voice
        await whatsapp.sendVoice(pendingRequest.requesterPhone, publicUrl);

        // 4. Update Pending Request
        await prisma.pendingRequest.update({
            where: { id: pendingRequest.id },
            data: {
                status: 'fulfilled',
                mediaType: 'audio' // Ensure consistency
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        logger.error('RunPod Webhook Error', { error: error.message, module: 'webhook_runpod' });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
