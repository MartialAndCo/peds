import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'

const cleanKey = (key?: string) => {
    if (!key) return undefined
    // Remove surrounding quotes and excessive whitespace/newlines
    // Also handles cases like "KEY"R where R is garbage after the closing quote
    return key.trim().replace(/^["']/, '').replace(/["'].*$/, '')
}

// Helper to get config from DB or Env
export async function getConfig() {
    try {
        const settings = await settingsService.getSettings()

        const defaultEndpoint = 'http://127.0.0.1:3001'
        const dbKey = cleanKey(settings.waha_api_key)
        const envKey = cleanKey(process.env.AUTH_TOKEN || process.env.WAHA_API_KEY)

        // If DB has default "secret" but Env has a real key, use Env
        let finalKey = dbKey
        if ((!dbKey || dbKey === 'secret') && envKey && envKey !== 'secret') {
            finalKey = envKey
        }

        return {
            endpoint: settings.waha_endpoint || process.env.WAHA_ENDPOINT || defaultEndpoint,
            apiKey: finalKey || 'secret',
            defaultSession: settings.waha_session || process.env.WAHA_SESSION || 'default',
            webhookSecret: process.env.WEBHOOK_SECRET
        }
    } catch (e) {
        logger.warn('Failed to fetch WhatsApp settings from DB, falling back to env/defaults', { module: 'whatsapp' })
        const envKey = cleanKey(process.env.AUTH_TOKEN || process.env.WAHA_API_KEY)
        return {
            endpoint: process.env.WAHA_ENDPOINT || 'http://127.0.0.1:3001',
            apiKey: envKey || 'secret',
            defaultSession: process.env.WAHA_SESSION || 'default',
            webhookSecret: process.env.WEBHOOK_SECRET
        }
    }
}

export const whatsapp = {
    async sendText(chatId: string, text: string, replyTo?: string, agentId?: number) {
        console.log(`[WhatsApp] Sending Text to ${chatId} (Agent: ${agentId}, Text: "${text.substring(0, 30)}...")`)
        const textPreview = text.substring(0, 50) + (text.length > 50 ? '...' : '')
        logger.info('Sending text message', { module: 'whatsapp', chatId, textPreview, agentId })
        const { endpoint, apiKey, defaultSession } = await getConfig()

        if (!endpoint) {
            logger.warn('WHATSAPP_ENDPOINT not configured', { module: 'whatsapp' })
            return { id: 'mock-id' }
        }

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            // Call our new microservice
            const url = `${endpoint}/api/sendText`
            console.log(`[WhatsApp] Posting to: ${url}`)
            const response = await axios.post(url, {
                sessionId: agentId?.toString() || defaultSession, // Use Agent ID or Default Session
                chatId: formattedChatId,
                text,
                replyTo
            }, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 15000 // 15s timeout
            })
            console.log(`[WhatsApp] SendText success (ID: ${response.data?.id?.id || 'unknown'})`)
            return response.data
        } catch (error: any) {
            logger.error('WhatsApp sendText failed', error, { module: 'whatsapp', chatId })
            if (error.code === 'ECONNABORTED') throw new Error('WhatsApp Service Timeout (15s)')
            throw new Error(`Failed to send WhatsApp message: ${error.message}`)
        }
    },

    async sendVoice(chatId: string, audioDataUrl: string, replyTo?: string, agentId?: number) {
        logger.info('Sending voice message', { module: 'whatsapp', chatId, agentId })
        const { endpoint, apiKey } = await getConfig()

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            let base64Data = audioDataUrl.split(',')[1] || audioDataUrl
            const mime = audioDataUrl.match(/^data:(.*?);base64,/)?.[1] || 'audio/mpeg'
            const ext = mime.split('/')[1] || 'mp3'

            // --- PAYLOAD OPTIMIZATION (Supabase Upload) ---
            // If the voice note is large, upload it to Supabase Storage first and send the URL.
            // This bypasses the 100kb/1mb body limit of the WhatsApp Server.
            let filePayload: any = {
                mimetype: mime,
                data: base64Data,
                filename: `voice.${ext}`
            }

            // Check if Supabase keys exist
            const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
            const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

            if (sbUrl && sbKey && base64Data.length > 50000) { // Optimize if > ~37KB
                try {
                    const { createClient } = require('@supabase/supabase-js')
                    const supabase = createClient(sbUrl, sbKey)
                    const buffer = Buffer.from(base64Data, 'base64')
                    const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

                    // Upload
                    const { error: uploadError } = await supabase.storage
                        .from('voice-uploads')
                        .upload(fileName, buffer, { contentType: mime, upsert: true })

                    if (!uploadError) {
                        const { data: publicData } = supabase.storage.from('voice-uploads').getPublicUrl(fileName)
                        if (publicData?.publicUrl) {
                            logger.info(`[WhatsApp] Optimized Voice Upload: ${publicData.publicUrl}`, { module: 'whatsapp' })
                            // Replace "data" with "url" - force WAV mime since that's what we uploaded
                            filePayload = {
                                mimetype: 'audio/wav',
                                url: publicData.publicUrl,
                                filename: 'voice.wav'
                            }
                        }
                    } else {
                        logger.warn('[WhatsApp] Voice Upload Failed (falling back to direct)', { error: uploadError })
                    }
                } catch (e: any) {
                    logger.warn('[WhatsApp] Voice Upload Error', { error: e.message || e })
                }
            }

            await axios.post(`${endpoint}/api/sendVoice`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId,
                file: filePayload,
                replyTo
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            logger.error('WhatsApp sendVoice failed', error, { module: 'whatsapp', chatId })
            throw new Error(`Failed to send Voice message: ${error.message}`)
        }
    },

    async sendFile(chatId: string, fileDataUrl: string, filename: string, caption?: string, agentId?: number) {
        logger.info('Sending file', { module: 'whatsapp', chatId, filename, agentId })
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            const base64Data = fileDataUrl.split(',')[1] || fileDataUrl

            await axios.post(`${endpoint}/api/sendFile`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId,
                file: {
                    mimetype: 'application/octet-stream',
                    data: base64Data,
                    filename: filename
                },
                caption: caption
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            logger.error('WhatsApp sendFile failed', error, { module: 'whatsapp', chatId, filename })
            throw new Error(`Failed to send File: ${error.message}`)
        }
    },

    /**
     * Send a reaction (like/heart/emoji) to a message
     * @param chatId - The chat to react in
     * @param messageId - The message ID to react to
     * @param emoji - The emoji to react with (e.g. "👍", "❤️", "😂")
     * @param agentId - Agent ID for multi-session support
     */
    async sendReaction(chatId: string, messageId: string, emoji: string, agentId?: number) {
        logger.info('Sending reaction', { module: 'whatsapp', chatId, messageId, emoji, agentId })
        const { endpoint, apiKey, defaultSession } = await getConfig()

        if (!endpoint) {
            logger.warn('WHATSAPP_ENDPOINT not configured', { module: 'whatsapp' })
            return { success: false }
        }

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            const response = await axios.post(`${endpoint}/api/sendReaction`, {
                sessionId: agentId?.toString() || defaultSession,
                chatId: formattedChatId,
                messageId,
                emoji
            }, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 10000
            })

            logger.info('Reaction sent successfully', { module: 'whatsapp', chatId, emoji })
            return { success: true, data: response.data }
        } catch (error: any) {
            logger.error('WhatsApp sendReaction failed', error, { module: 'whatsapp', chatId, messageId })
            return { success: false, error: error.message }
        }
    },

    async sendImage(chatId: string, dataUrl: string, caption?: string, agentId?: number) {
        logger.info('Sending image', { module: 'whatsapp', chatId, agentId })
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            let base64Data = ''
            let mime = 'image/jpeg'

            if (dataUrl.startsWith('http')) {
                // Fetch remote URL
                const res = await axios.get(dataUrl, { responseType: 'arraybuffer' })
                const buf = Buffer.from(res.data)
                base64Data = buf.toString('base64')
                mime = res.headers['content-type'] || 'image/jpeg'
            } else {
                base64Data = dataUrl.split(',')[1] || dataUrl
                mime = dataUrl.match(/^data:(.*?);base64,/)?.[1] || 'image/jpeg'
            }

            const ext = mime.split('/')[1] || 'jpg'

            await axios.post(`${endpoint}/api/sendImage`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId,
                file: {
                    mimetype: mime,
                    data: base64Data,
                    filename: `image.${ext}`
                },
                caption: caption
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            logger.error('WhatsApp sendImage failed', error, { module: 'whatsapp', chatId })
            throw new Error(`Failed to send Image: ${error.message}`)
        }
    },

    async sendVideo(chatId: string, dataUrl: string, caption?: string, agentId?: number) {
        logger.info('Sending video', { module: 'whatsapp', chatId, agentId })
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            let base64Data = ''
            let mime = 'video/mp4'

            if (dataUrl.startsWith('http')) {
                // Fetch remote URL
                const res = await axios.get(dataUrl, { responseType: 'arraybuffer' })
                const buf = Buffer.from(res.data)
                base64Data = buf.toString('base64')
                mime = res.headers['content-type'] || 'video/mp4'
            } else {
                base64Data = dataUrl.split(',')[1] || dataUrl
                mime = dataUrl.match(/^data:(.*?);base64,/)?.[1] || 'video/mp4'
            }

            const ext = mime.split('/')[1] || 'mp4'

            await axios.post(`${endpoint}/api/sendVideo`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId,
                file: {
                    mimetype: mime,
                    data: base64Data,
                    filename: `video.${ext}`
                },
                caption: caption
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            logger.error('WhatsApp sendVideo failed', error, { module: 'whatsapp', chatId })
            throw new Error(`Failed to send Video: ${error.message}`)
        }
    },

    // Get Status (replaces getSessionStatus)
    async getStatus(agentId?: number) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const url = agentId ? `${endpoint}/api/sessions/${agentId}/status` : `${endpoint}/status`
            // console.log(`[WhatsApp] Checking Status: ${url}`)
            const response = await axios.get(url, {
                headers: { 'X-Api-Key': apiKey }, // Ensure Auth is sent
                timeout: 5000
            })
            return response.data
        } catch (e: any) {
            logger.error('WhatsApp status check failed', e, { module: 'whatsapp', agentId })
            if (e.response?.status === 404) return { status: 'OFFLINE', error: 'Session not found' }
            return { status: 'UNREACHABLE', error: e.message }
        }
    },

    // Reset Session (Clear auth data and restart fresh)
    async resetSession(sessionId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            logger.info(`Resetting session: ${sessionId}`, { module: 'whatsapp' })
            const response = await axios.post(`${endpoint}/api/sessions/reset`,
                { sessionId },
                { headers: { 'X-Api-Key': apiKey }, timeout: 10000 }
            )
            return response.data
        } catch (e: any) {
            logger.error(`Reset Failed`, e, { module: 'whatsapp', sessionId })
            throw new Error(e.response?.data?.error || e.message)
        }
    },

    // Download Media (No agentId needed usually, cached global or by ID)
    async downloadMedia(messageId: string) {
        const { endpoint, apiKey } = await getConfig()
        const MAX_RETRIES = 5
        const RETRY_DELAY_MS = 2000

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Encode ID to handle @c.us etc safely in URL. Request WAV format for audio.
                const url = `${endpoint}/api/messages/${encodeURIComponent(messageId)}/media?format=wav`
                logger.info(`Downloading media (Attempt ${attempt}/${MAX_RETRIES})`, { module: 'whatsapp_client', url, messageId })

                const response = await axios.get(url, {
                    headers: { 'X-Api-Key': apiKey },
                    responseType: 'arraybuffer'
                })

                const mimetype = response.headers['content-type']
                return {
                    mimetype,
                    data: Buffer.from(response.data)
                }
            } catch (error: any) {
                const is404 = error.response?.status === 404
                if (is404 && attempt < MAX_RETRIES) {
                    logger.warn(`Media 404 Not Found (Attempt ${attempt}). Retrying in ${RETRY_DELAY_MS}ms...`, { traceId: messageId })
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
                    continue
                }

                logger.error('Download Media Error', error, { module: 'whatsapp_client', status: error.response?.status })
                return null
            }
        }
        return null
    },

    async markAsRead(chatId: string, agentId?: number, messageKey?: any) {
        const { endpoint, apiKey, defaultSession } = await getConfig()
        const MAX_RETRIES = 3

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
                // If 'all' is true, we should NOT pass messageKey, to force a chat-level "mark seen"
                // which clears all unread messages. Passing a key might restrict it to "read up to this message".
                const payload: any = {
                    sessionId: agentId?.toString() || defaultSession,
                    chatId: formattedChatId,
                    all: true
                }
                // Only attach key if we are NOT marking all (which we currently always do, but for future proofing)
                payload.messageKey = messageKey

                await axios.post(`${endpoint}/api/markSeen`, payload, {
                    headers: { 'X-Api-Key': apiKey }
                })

                // If successful, break
                return
            } catch (error: any) {
                if (i === MAX_RETRIES - 1) {
                    logger.error(`MarkRead Failed after ${MAX_RETRIES} attempts`, error, { module: 'whatsapp' })
                } else {
                    // Wait small delay before retry
                    await new Promise(r => setTimeout(r, 1000 * (i + 1)))
                }
            }
        }
    },

    async sendTypingState(chatId: string, isTyping: boolean, agentId?: number) {
        const { endpoint, apiKey, defaultSession } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendStateTyping`, {
                sessionId: agentId?.toString() || defaultSession,
                chatId: formattedChatId,
                isTyping
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            logger.error('TypingStatus Error', error, { module: 'whatsapp' })
        }
    },

    async sendRecordingState(chatId: string, isRecording: boolean, agentId?: number) {
        const { endpoint, apiKey, defaultSession } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendStateRecording`, {
                sessionId: agentId?.toString() || defaultSession,
                chatId: formattedChatId,
                isRecording
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            logger.error('RecordingStatus Error', error, { module: 'whatsapp' })
        }
    },

    async adminStatus() {
        const { endpoint, apiKey } = await getConfig()
        try {
            // Baileys Docker uses /status endpoint directly
            const response = await axios.get(`${endpoint}/status`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
            // Wrap response for compatibility with system page
            return { success: true, status: response.data }
        } catch (error: any) {
            // Suppress connection refused logs (Docker offline)
            if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
                return { success: false, error: 'Service Offline', status: null }
            }
            logger.error('Admin Status Error', error, { module: 'whatsapp' })
            return { success: false, error: error.message, status: null }
        }
    },

    async adminLogs(lines: number = 100) {
        const { endpoint, apiKey } = await getConfig()
        try {
            // Baileys Docker uses /api/logs endpoint
            const response = await axios.get(`${endpoint}/api/logs?lines=${lines}`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
            return { success: true, lines: response.data.lines || [] }
        } catch (error: any) {
            // Suppress connection refused logs (Docker offline)
            if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
                return { success: false, error: 'Service Offline', lines: [] }
            }
            logger.error('Admin Logs Error', error, { module: 'whatsapp' })
            return { success: false, error: error.message, lines: [] }
        }
    },

    async adminAction(action: string, agentId?: number) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const response = await axios.post(`${endpoint}/api/admin/action`,
                { action, sessionId: agentId?.toString() },
                {
                    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            )
            return response.data
        } catch (error: any) {
            logger.error('Admin Action Error', error, { module: 'whatsapp' })
            return { success: false, error: error.message }
        }
    },

    async repairSession(sessionId: string = '1') {
        const { endpoint, apiKey } = await getConfig()
        try {
            logger.info('Repairing session', { module: 'whatsapp', sessionId })
            const response = await axios.post(`${endpoint}/api/sessions/repair`,
                { sessionId },
                {
                    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            )
            return response.data
        } catch (error: any) {
            logger.error('Repair Session Error', error, { module: 'whatsapp' })
            return { success: false, message: error.message }
        }
    },

    // NEW: Session Management
    async startSession(agentId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            await axios.post(`${endpoint}/api/sessions/start`, { sessionId: agentId }, {
                headers: { 'X-Api-Key': apiKey }
            })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    },

    async stopSession(agentId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            await axios.post(`${endpoint}/api/sessions/stop`, { sessionId: agentId }, {
                headers: { 'X-Api-Key': apiKey }
            })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    },

    // Delete Session PERMANENTLY (Stop + remove auth data, NO restart)
    async deleteSession(agentId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            logger.info(`Deleting session permanently`, { module: 'whatsapp', agentId })
            await axios.post(`${endpoint}/api/sessions/delete`,
                { sessionId: agentId },
                { headers: { 'X-Api-Key': apiKey }, timeout: 10000 }
            )
            return { success: true }
        } catch (error: any) {
            logger.error(`Delete session failed`, error, { module: 'whatsapp', agentId })
            return { success: false, error: error.message }
        }
    }
}
