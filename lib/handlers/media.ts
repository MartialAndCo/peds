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
    settings: any,
    agentId?: number
) {
    // Include ptt/audio so voice notes are correctly routed and don't fall through
    const isMedia = payload.type === 'image' || payload.type === 'video' || payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('image') || payload._data?.mimetype?.startsWith('video') || payload._data?.mimetype?.startsWith('audio')

    if (!isMedia) return { handled: false }

    const voiceSourcePhone = settings.voice_source_number || settings.source_phone_number

    // Check if it is a VOICE NOTE from Voice Source
    const isVoiceNote = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')
    const isVoiceSource = voiceSourcePhone && normalizedPhone.includes(voiceSourcePhone.replace('+', ''))

    if (isVoiceSource && isVoiceNote) {
        logger.info('Voice source sent audio', { module: 'media', sourcePhone: normalizedPhone })
        let mediaData = payload.body

        if (!mediaData || mediaData.length < 100) {
            // downloadMedia returns { mimetype, data: Buffer } - extract and convert to base64
            const downloaded = await whatsapp.downloadMedia(payload.id)
            if (downloaded && downloaded.data) {
                mediaData = Buffer.isBuffer(downloaded.data)
                    ? downloaded.data.toString('base64')
                    : downloaded.data
                logger.info('Extracted base64 from downloaded media', { module: 'media', length: mediaData?.length })
            } else {
                mediaData = null
            }
        }

        if (mediaData) {
            const result = await voiceService.ingestVoice(normalizedPhone, mediaData)

            if (result.action === 'processing') {
                // await whatsapp.sendText(sourcePhone, spin(`{🎙️|🗣️} **{Voice Received|Processing...}**\n\nConverting voice...`), undefined, agentId)
            } else if (result.action === 'saved_no_request') {
                // await whatsapp.sendText(sourcePhone, spin(`{⚠️|ℹ️} {Voice stored|Saved} but no pending request.`), undefined, agentId)
            } else if (result.action === 'error') {
                await whatsapp.sendText(sourcePhone, spin(`{❌|⚠️} Failed to process voice.`), undefined, agentId)
            }

            return { handled: true, type: 'source_voice_ingest' }
        }
    }

    // Normal Media Logic (Images/Videos)
    logger.info('Source sent media', { module: 'media', sourcePhone, mimeType: payload._data?.mimetype || payload.type })
    let mediaData = payload.body
    let mimeType = payload._data?.mimetype || payload.type || 'image/jpeg'

    if (!mediaData || mediaData.length < 100) {
        const downloaded = await whatsapp.downloadMedia(payload.id)
        if (downloaded && downloaded.data) {
            // Extract base64 data from buffer/string
            mediaData = Buffer.isBuffer(downloaded.data)
                ? downloaded.data.toString('base64')
                : (typeof downloaded.data === 'string' ? downloaded.data : null)
            // Use downloaded mimetype if available
            if (downloaded.mimetype) {
                mimeType = downloaded.mimetype
            }
            logger.info('Extracted media from download', { module: 'media', length: mediaData?.length, mimeType })
        } else {
            mediaData = null
        }
    }

    if (mediaData && typeof mediaData === 'string') {
        const ingestionResult = await mediaService.ingestMedia(sourcePhone, mediaData, mimeType)

        if (ingestionResult) {
            await whatsapp.sendText(sourcePhone, spin(`{✅|📥} {Media ingested|Photo received}. Analyzing...`), undefined, agentId)

            // Delegate to Service
            await mediaService.processAdminMedia(sourcePhone, ingestionResult)
        } else {
            await whatsapp.sendText(sourcePhone, spin(`{✅|💾} {Media stored|Saved} (Uncategorized).`), undefined, agentId)
        }
        return { handled: true, type: 'source_media' }
    }

    return { handled: false }
}
