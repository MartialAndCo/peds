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

        // 2. Create Pending Request
        await prisma.pendingRequest.create({
            data: {
                requesterPhone: contactPhone,
                mediaType: 'audio',
                description: textToSay,
                status: 'pending',
            }
        })

        // 3. Notify Source
        const message = `🎤 **New Voice Request**\n\n*${context}*\n\nPlease say:\n\n*${textToSay}*\n\nReply with the Voice Note.`
        await whatsapp.sendText(sourcePhone, message)

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

        // 2. Save Voice Clip
        const transcript = pending.description
        let category = await prisma.voiceCategory.findFirst({ where: { id: 'general' } })
        if (!category) {
            category = await prisma.voiceCategory.create({ data: { id: 'general', description: 'General replies' } })
        }

        // Use base64 data uri for now
        const audioUrl = mediaData.startsWith('data:') ? mediaData : `data:audio/ogg;base64,${mediaData}`

        const clip = await prisma.voiceClip.create({
            data: {
                categoryId: category.id,
                url: audioUrl,
                transcript: transcript,
                sourcePhone: sourcePhone,
                sentTo: [] // Not sent yet
            }
        })

        // 3. Update Pending Request to CONFIRMING (Link via description hack or just assume order?)
        // Ideally we should link the clip to the request. But schema is rigid.
        // We'll trust the order. We mark it as 'confirming'.
        // We need to store WHICH clip is waiting. Detailed status?
        // Let's use `typeId` field in PendingRequest to store the clip ID temporarily? It's a string.
        await prisma.pendingRequest.update({
            where: { id: pending.id },
            data: {
                status: 'confirming',
                typeId: clip.id.toString() // Link the clip
            }
        })

        return {
            action: 'confirming',
            clipId: clip.id,
            transcript: transcript
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
            const clipId = parseInt(request.typeId || '0')
            const clip = await prisma.voiceClip.findUnique({ where: { id: clipId } })

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
                data: { status: 'pending', typeId: null }
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
