// lib/handlers/media.ts
import { whatsapp } from '@/lib/whatsapp'
import { voiceService } from '@/lib/voice'
import { mediaService } from '@/lib/media'
import { spin } from '@/lib/spintax'
import { logger } from '@/lib/logger'


export async function handleSourceMedia(
    payload: any,
    sourcePhone: string,
    normalizedPhone: string,
    settings: any
) {
    const isMedia = payload.type === 'image' || payload.type === 'video' || payload._data?.mimetype?.startsWith('image') || payload._data?.mimetype?.startsWith('video')

    if (!isMedia) return { handled: false }

    const voiceSourcePhone = settings.voice_source_number || settings.source_phone_number

    // Check if it is a VOICE NOTE from Voice Source
    const isVoiceNote = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')
    const isVoiceSource = voiceSourcePhone && normalizedPhone.includes(voiceSourcePhone.replace('+', ''))

    if (isVoiceSource && isVoiceNote) {
        logger.info('Voice source sent audio', { module: 'media', sourcePhone: normalizedPhone })
        let mediaData = payload.body
        if (!mediaData || mediaData.length < 100) {
            mediaData = await whatsapp.downloadMedia(payload.id)
        }

        if (mediaData) {
            const result = await voiceService.ingestVoice(normalizedPhone, mediaData)

            if (result.action === 'processing') {
                await whatsapp.sendText(sourcePhone, spin(`{🎙️|🗣️} **{Voice Received|Processing...}**\n\nConverting voice...`))
            } else if (result.action === 'saved_no_request') {
                await whatsapp.sendText(sourcePhone, spin(`{⚠️|ℹ️} {Voice stored|Saved} but no pending request.`))
            } else if (result.action === 'error') {
                await whatsapp.sendText(sourcePhone, spin(`{❌|⚠️} Failed to process voice.`))
            }

            return { handled: true, type: 'source_voice_ingest' }
        }
    }

    // Normal Media Logic (Images/Videos)
    logger.info('Source sent media', { module: 'media', sourcePhone, mimeType: payload._data?.mimetype || payload.type })
    let mediaData = payload.body
    if (!mediaData || mediaData.length < 100) {
        mediaData = await whatsapp.downloadMedia(payload.id)
    }

    if (mediaData) {
        const ingestionResult = await mediaService.ingestMedia(sourcePhone, mediaData, payload._data?.mimetype || payload.type)

        if (ingestionResult) {
            await whatsapp.sendText(sourcePhone, spin(`{✅|📥} {Media ingested|Photo received}. Analyzing...`))

            // Delegate to Service
            await mediaService.processAdminMedia(sourcePhone, ingestionResult)
        } else {
            await whatsapp.sendText(sourcePhone, spin(`{✅|💾} {Media stored|Saved} (Uncategorized).`))
        }
        return { handled: true, type: 'source_media' }
    }

    return { handled: false }
}
