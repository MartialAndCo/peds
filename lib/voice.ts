import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import Fuse from 'fuse.js'

export const voiceService = {
    /**
     * Request a voice note from the Human Source.
     */
    async requestVoice(contactPhone: string, textToSay: string, context: string) {
        // 1. Get Settings
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        const sourcePhone = settings.voice_source_number
        if (!sourcePhone) {
            console.error('[Voice] No voice_source_number configured.')
            return 'NO_SOURCE'
        }

        // 2. Create Pending Request (using PendingRequest table or just MessageQueue?)
        // The implementation plan suggested just notifying source. 
        // We need to know who to forward it to when it comes back.
        // We can reuse `PendingRequest` table but add a `type="voice"` flag or just use `description`.

        // Let's CREATE a PendingRequest
        await prisma.pendingRequest.create({
            data: {
                requesterPhone: contactPhone,
                mediaType: 'audio', // New type
                description: textToSay, // We store the text to say here
                status: 'pending',
                // We don't link to a mediaType strictly, or we could create a dummy one.
            }
        })

        // 3. Notify Source
        const message = `🎤 **Voice Request**\n\n**Context:** ${context}\n**Say:** "${textToSay}"\n\nReply to this message with a **Voice Note**.`
        await whatsapp.sendText(sourcePhone, message)

        return 'REQUESTED'
    },

    /**
     * Ingest a voice note sent by the Human Source.
     */
    async ingestVoice(sourcePhone: string, mediaData: string, replyToMessageId?: string, messageBody?: string) {
        console.log('[Voice] Ingesting voice from source...')

        // 1. Find the Pending Request
        // If the source replied to a specific message, we could try to track it, but often they just send it.
        // Let's look for the *oldest* pending audio request.

        const pending = await prisma.pendingRequest.findFirst({
            where: {
                status: 'pending',
                mediaType: 'audio'
            },
            orderBy: { createdAt: 'asc' }
        })

        if (!pending) {
            console.log('[Voice] No pending voice requests found.')
            return null
        }

        // 2. Save to VoiceClip
        const transcript = pending.description // The text we asked for

        // Check if category exists or create "general"
        let category = await prisma.voiceCategory.findFirst({ where: { id: 'general' } })
        if (!category) {
            category = await prisma.voiceCategory.create({ data: { id: 'general', description: 'General replies' } })
        }

        // We need to upload this media somewhere permanent? 
        // For now, `mediaData` is base64. We need a URL.
        // In the MediaService we use `uploadToS3` or similar? 
        // If we don't have S3 set up in this snippet, we might store base64 temporarily (bad practice) or rely on WAHA?
        // Wait, `Media` model has `url`. Ideally we assume `mediaService.upload` exists.
        // Let's check `lib/media.ts` via import or duplication? 
        // To be safe and simple: let's assume we can treat base64 as the "url" (data URI) for now if small, 
        // OR we just use the `whatsapp.downloadMedia` result which gives base64.

        // NOTE: In production, upload this to S3/R2. For this task, we'll store the data URI 
        // (Postgres text limit might be hit for long audio, but for short voice < 1MB it fits in Text/Bytea often, though not recommended).
        // Let's check if we have an upload utility. I'll mock `saveMedia` logic or assume data-uri is okay for prototype.
        const audioUrl = mediaData.startsWith('data:') ? mediaData : `data:audio/ogg;base64,${mediaData}`

        const clip = await prisma.voiceClip.create({
            data: {
                categoryId: category.id,
                url: audioUrl,
                transcript: transcript,
                sourcePhone: sourcePhone,
                sentTo: [pending.requesterPhone] // Mark as sent to the requester
            }
        })

        // 3. Mark Pending as Fulfilled
        await prisma.pendingRequest.update({
            where: { id: pending.id },
            data: { status: 'fulfilled' }
        })

        // 4. Return info to Caller (to send it)
        return {
            clip,
            targetPhone: pending.requesterPhone
        }
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
