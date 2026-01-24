import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import Fuse from 'fuse.js'
import { settingsService } from '@/lib/settings-cache'

export const voiceService = {
    /**
     * Request a voice note from the Human Source.
     * @param agentSettings - Optional agent-specific settings (overrides global)
     */
    async requestVoice(contactPhone: string, textToSay: string, context: string, agentSettings?: any, agentId?: string) {
        console.log(`[VoiceService] Requesting voice for ${contactPhone}. Text: "${textToSay}"`)
        // 1. Get Settings (Agent settings override global)
        const globalSettings = await settingsService.getSettings()
        const settings = agentSettings ? { ...globalSettings, ...agentSettings } : globalSettings

        const sourcePhone = settings.voice_source_number
        if (!sourcePhone) {
            console.error('[Voice] No voice_source_number configured.')
            return 'NO_SOURCE'
        }
        console.log(`[VoiceService] Using voice_source_number: ${sourcePhone}`)

        // 2. Create Pending Request
        await prisma.pendingRequest.create({
            data: {
                requesterPhone: contactPhone,
                mediaType: 'audio',
                description: textToSay,
                status: 'pending',
            }
        })

        // Notify source what to say (initial request only - no confirmations/reminders)
        const message = `"${textToSay}"`
        await whatsapp.sendText(sourcePhone, message, undefined, agentId)

        return 'REQUESTED'
    },

    /**
     * Ingest a voice note sent by the Human Source.
     */
    async ingestVoice(sourcePhone: string, mediaData: string) {
        console.log('[Voice] Ingesting voice from source...')

        // 1. Find the Pending Request (Oldest PENDING)
        const pending = await prisma.pendingRequest.findFirst({
            where: {
                status: 'pending',
                mediaType: 'audio'
            },
            orderBy: { createdAt: 'asc' }
        })

        if (!pending) {
            console.log('[Voice] No pending voice requests found.')
            return { action: 'saved_no_request' }
        }

        // 2. Prepare Source Audio and Start Job
        try {
            // Resolve Agent ID from Requester
            const contact = await prisma.contact.findUnique({
                where: { phone_whatsapp: pending.requesterPhone },
                include: { conversations: { orderBy: { createdAt: 'desc' }, take: 1, select: { agentId: true } } }
            })
            const agentId = contact?.conversations?.[0]?.agentId || undefined
            console.log(`[Voice] Ingesting for Contact ${pending.requesterPhone}. Found Agent ID: ${agentId}`)

            // Prepare Input (Supabase Check)
            let finalAudioInput = mediaData;
            let sourceUrl = null;

            // Simple check for base64 length (approx 6MB check)
            if (mediaData.length > 8 * 1024 * 1024) {
                console.log('[Voice] Source Audio > 8MB. Uploading to Supabase...');
                const { createClient } = require('@supabase/supabase-js');
                const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
                const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                if (url && key) {
                    const supabase = createClient(url, key);
                    const buffer = Buffer.from(mediaData.includes('base64,') ? mediaData.split('base64,')[1] : mediaData, 'base64');
                    const fileName = `source_voice_${pending.id}_${Date.now()}.mp3`;
                    const { error: upErr } = await supabase.storage.from('voice-uploads').upload(fileName, buffer, { contentType: 'audio/mpeg' });

                    if (!upErr) {
                        const { data } = supabase.storage.from('voice-uploads').getPublicUrl(fileName);
                        if (data?.publicUrl) {
                            finalAudioInput = data.publicUrl;
                            sourceUrl = data.publicUrl;
                        }
                    }
                }
            }

            // Start Async Job
            const { rvcService } = require('@/lib/rvc')
            const jobId = await rvcService.startJob(finalAudioInput, { agentId })

            if (jobId) {
                // Update Request to PROCESSING
                await prisma.pendingRequest.update({
                    where: { id: pending.id },
                    data: {
                        status: 'processing',
                        jobId: jobId,
                        sourceAudioUrl: sourceUrl
                    }
                })
                return { action: 'processing', message: 'Converting voice...', jobId }
            } else {
                throw new Error("Failed to start RVC Job");
            }

        } catch (rvcErr) {
            console.error('[Voice] Failed to start transformation:', rvcErr)
            return { action: 'error' }
        }
    },

    /**
     * Handle Confirmation (OK/NO) from Source
     */
    async handleConfirmation(sourcePhone: string, text: string) {
        const cleanText = text.trim().toUpperCase().replace(/[^A-Z]/g, '')

        // Find the request currently in 'confirming' state
        const request = await prisma.pendingRequest.findFirst({
            where: { status: 'confirming', mediaType: 'audio' },
            orderBy: { createdAt: 'asc' }
        })

        if (!request) return null

        if (cleanText === 'OK' || cleanText === 'YES') {
            // SEND IT
            // Find the clip by transcript (most recent)
            const clip = await prisma.voiceClip.findFirst({
                where: { transcript: request.description },
                orderBy: { createdAt: 'desc' }
            })

            if (clip) {
                // Determine target
                const targetPhone = request.requesterPhone

                // Send
                await whatsapp.markAsRead(targetPhone).catch(e => { })
                await whatsapp.sendVoice(targetPhone, clip.url)

                // Update Clip stats
                await prisma.voiceClip.update({
                    where: { id: clip.id },
                    data: { sentTo: { push: targetPhone } }
                })

                // Mark Request Fulfilled
                await prisma.pendingRequest.update({
                    where: { id: request.id },
                    data: { status: 'fulfilled' }
                })

                // Monthly Stats
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const count = await prisma.voiceClip.count({
                    where: { createdAt: { gte: firstDay } }
                })

                return {
                    status: 'sent',
                    targetPhone,
                    stats: count
                }
            }
        } else if (cleanText === 'NO' || cleanText === 'RETRY') {
            // RETRY
            // Delete the bad clip? Or keep it? Let's keep it as wasted.
            // Reset request to 'pending'
            await prisma.pendingRequest.update({
                where: { id: request.id },
                data: { status: 'pending' }
            })

            return { status: 'retry', transcript: request.description }
        }

        return { status: 'unknown' }
    },

    /**
     * Find a reusable voice note.
     */
    async findReusableVoice(text: string) {
        // 1. Get all clips
        // Optimization: Use Postgres Full Text Search if available, or Fuse.js in memory for small datasets.
        const clips = await prisma.voiceClip.findMany()

        if (clips.length === 0) return null

        const fuse = new Fuse(clips, {
            keys: ['transcript'],
            threshold: 0.3, // Strictness
            includeScore: true
        })

        const result = fuse.search(text)

        if (result.length > 0) {
            const bestMatch = result[0]
            console.log(`[Voice] Found match: "${bestMatch.item.transcript}" (Score: ${bestMatch.score})`)
            return bestMatch.item
        }

        return null
    }
}
