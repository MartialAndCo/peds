import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'
import { logWhatsAppError } from '@/lib/monitoring/system-logger'

const cleanKey = (key?: string) => {
    if (!key) return undefined
    return key.trim().replace(/^["']/, '').replace(/["'].*$/, '')
}

// Helper to get config from DB or Env
export async function getConfig() {
    // Known defaults
    const KNOWN_KEY = 'e3f9a1c4d8b2f0a7c5e6d9b1a4f8c2d0e7b5a9c3f1d4b8e6a2f0c7'
    const KNOWN_ENDPOINT = 'http://localhost:3001'

    try {
        const settings = await settingsService.getSettings() || {}

        const dbKey = cleanKey(settings['waha_api_key'] as string)
        const envKey = cleanKey(process.env.AUTH_TOKEN || process.env.WAHA_API_KEY)

        // Priority: DB > Env > Known
        const apiKey = (dbKey && dbKey !== 'secret') ? dbKey : (envKey && envKey !== 'secret' ? envKey : KNOWN_KEY)

        let endpoint = (settings['waha_endpoint'] as string) || process.env.WAHA_ENDPOINT || KNOWN_ENDPOINT
        const defaultSession = (settings['waha_session'] as string) || process.env.WAHA_SESSION || 'default'

        return {
            endpoint,
            apiKey,
            defaultSession,
            webhookSecret: process.env.WEBHOOK_SECRET
        }
    } catch (e) {
        logger.warn('Failed to fetch WhatsApp settings, falling back to known defaults', { module: 'whatsapp' })

        const envKey = cleanKey(process.env.AUTH_TOKEN || process.env.WAHA_API_KEY)
        let fallbackEndpoint = process.env.WAHA_ENDPOINT || KNOWN_ENDPOINT
        return {
            endpoint: fallbackEndpoint,
            apiKey: envKey || KNOWN_KEY,
            defaultSession: process.env.WAHA_SESSION || 'default',
            webhookSecret: process.env.WEBHOOK_SECRET
        }
    }
}

// Helper to resolve the actual Baileys Session ID (handles UUIDs and legacy IDs)
async function resolveSessionId(agentId?: number | string): Promise<string> {
    if (!agentId) {
        // NEVER fall back to "default" - find the first active agent's session
        try {
            const firstAgent = await prisma.agent.findFirst({
                where: { isActive: true },
                select: { id: true }
            })
            if (firstAgent) {
                console.warn(`[WhatsApp] No agentId provided, using first active agent: ${firstAgent.id}`)
                return firstAgent.id
            }
        } catch (e) {
            console.error('[WhatsApp] Failed to find fallback agent:', e)
        }
        // Last resort: use config default (may still be "default" but logged)
        const { defaultSession } = await getConfig()
        console.error(`[WhatsApp] CRITICAL: No agent found, falling back to session: ${defaultSession}`)
        return defaultSession
    }

    try {
        // Check if we have a custom waha_id in settings for this agent
        const setting = await prisma.agentSetting.findFirst({
            where: {
                // FIXED: agentId is now a string (CUID) or number (Legacy fallback)
                agentId: agentId.toString(),
                key: 'waha_id'
            }
        })

        if (setting?.value) {
            return setting.value
        }
    } catch (e) {
        // Fallback to legacy ID on error
    }

    return agentId.toString()
}

async function withWahaRetry<T>(
    operationName: string,
    sessionId: string,
    operation: () => Promise<T>
): Promise<T> {
    const { endpoint, apiKey } = await getConfig();
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            const status = error.response?.status;

            // If 404 (Session Not Found) or 503 (Unavailable), try to auto-restart the session
            // t3.small EC2 instances might crash WAHA under load.
            if ((status === 404 || status === 503 || status === 502) && attempt < MAX_RETRIES) {
                logger.warn(`[WhatsApp] ${operationName} ${status} error (Attempt ${attempt}). Auto-restarting session...`, { sessionId });
                try {
                    await axios.post(`${endpoint}/api/sessions/start`, { sessionId }, { headers: { 'X-Api-Key': apiKey }, timeout: 10000 });
                    // Provide adequate time for Baileys to reconnect
                    await new Promise(r => setTimeout(r, 6000));
                    continue; // retry operation
                } catch (startError: any) {
                    // Ignore 409 Conflict (Session already starting/started)
                    if (startError.response?.status !== 409) {
                        logger.warn(`[WhatsApp] ${operationName} Auto-restart failed`, { error: startError.message });
                    }
                    // Wait anyway, maybe it's booting up
                    await new Promise(r => setTimeout(r, 4000));
                    continue;
                }
            }

            // Raise error to be handled by the specific function
            if (attempt === MAX_RETRIES || (status !== 404 && status !== 503 && status !== 502)) {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached');
}

export const whatsapp = {
    async sendText(chatId: string, text: string, replyTo?: string, agentId?: string) {
        // console.log(`[WhatsApp] Sending Text to ${chatId} (Agent: ${agentId})`)
        const sessionId = await resolveSessionId(agentId)
        const textPreview = text.substring(0, 50) + (text.length > 50 ? '...' : '')
        logger.info('Sending text message', { module: 'whatsapp', chatId, textPreview, sessionId })
        const { endpoint, apiKey } = await getConfig()

        // --- DISCORD ROUTING ---
        if (chatId.startsWith('DISCORD_')) {
            const discordEndpoint = process.env.DISCORD_API_ENDPOINT || 'http://localhost:3002' // Default to local Discord Service
            const discordUserId = chatId.replace('DISCORD_', '').replace('@discord', '')

            try {
                logger.info(`Routing to Discord Service: ${discordEndpoint}`, { chatId, discordUserId })
                const response = await axios.post(`${discordEndpoint}/api/sendText`, {
                    chatId: discordUserId,
                    text
                }, {
                    timeout: 30000 // Increased to 30s to accommodate typing simulation (max 10s)
                })
                return response.data
            } catch (error: any) {
                logger.error('Discord sendText failed', error, { module: 'discord', chatId })
                throw new Error(`Failed to send Discord message: ${error.message}`)
            }
        }
        // -----------------------

        if (!endpoint) {
            logger.warn('WHATSAPP_ENDPOINT not configured', { module: 'whatsapp' })
            return { id: 'mock-id' }
        }

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            // Call our new microservice
            const url = `${endpoint}/api/sendText`
            const response = await withWahaRetry('sendText', sessionId, () =>
                axios.post(url, {
                    sessionId: sessionId,
                    chatId: formattedChatId,
                    text,
                    replyTo
                }, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 20000 // 20s timeout
                })
            )
            console.log(`[WhatsApp] SendText success (ID: ${response.data?.id?.id || 'unknown'})`)
            return response.data
        } catch (error: any) {
            logger.error('WhatsApp sendText failed', error, { module: 'whatsapp', chatId })
            if (error.code === 'ECONNABORTED') throw new Error('WhatsApp Service Timeout (20s)')
            throw new Error(`Failed to send WhatsApp message: ${error.message}`)
        }
    },

    async sendVoice(chatId: string, audioDataUrl: string, replyTo?: string, agentId?: string) {
        logger.info('Sending voice message', { module: 'whatsapp', chatId, agentId })
        const { endpoint, apiKey } = await getConfig()

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            let base64Data = audioDataUrl.split(',')[1] || audioDataUrl
            const mime = audioDataUrl.match(/^data:(.*?);base64,/)?.[1] || 'audio/mpeg'
            const ext = mime.split('/')[1] || 'mp3'

            // --- PAYLOAD OPTIMIZATION (Supabase Upload) ---
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

            const sessionId = await resolveSessionId(agentId);
            const response = await withWahaRetry('sendVoice', sessionId, () =>
                axios.post(`${endpoint}/api/sendVoice`, {
                    sessionId: sessionId,
                    chatId: formattedChatId,
                    file: filePayload,
                    replyTo
                }, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 30000
                })
            )
            return response.data
        } catch (error: any) {
            logger.error('WhatsApp sendVoice failed', error, { module: 'whatsapp', chatId })
            throw new Error(`Failed to send Voice message: ${error.message}`)
        }
    },

    async sendFile(chatId: string, fileDataUrl: string, filename: string, caption?: string, agentId?: string) {
        logger.info('Sending file', { module: 'whatsapp', chatId, filename, agentId })
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            const base64Data = fileDataUrl.split(',')[1] || fileDataUrl

            const sessionId = await resolveSessionId(agentId);
            await withWahaRetry('sendFile', sessionId, () =>
                axios.post(`${endpoint}/api/sendFile`, {
                    sessionId: sessionId,
                    chatId: formattedChatId,
                    file: {
                        mimetype: 'application/octet-stream',
                        data: base64Data,
                        filename: filename
                    },
                    caption: caption
                }, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 30000
                })
            )
        } catch (error: any) {
            logger.error('WhatsApp sendFile failed', error, { module: 'whatsapp', chatId, filename })
            throw new Error(`Failed to send File: ${error.message}`)
        }
    },

    async sendReaction(chatId: string, messageId: string, emoji: string, agentId?: string) {
        logger.info('Sending reaction', { module: 'whatsapp', chatId, messageId, emoji, agentId })
        const { endpoint, apiKey } = await getConfig()

        if (!endpoint) {
            logger.warn('WHATSAPP_ENDPOINT not configured', { module: 'whatsapp' })
            return { success: false }
        }

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            const sessionId = await resolveSessionId(agentId);
            const response = await withWahaRetry('sendReaction', sessionId, () =>
                axios.post(`${endpoint}/api/sendReaction`, {
                    sessionId: sessionId,
                    chatId: formattedChatId,
                    messageId,
                    emoji
                }, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 10000
                })
            )

            logger.info('Reaction sent successfully', { module: 'whatsapp', chatId, emoji })
            return { success: true, data: response.data }
        } catch (error: any) {
            logger.error('WhatsApp sendReaction failed', error, { module: 'whatsapp', chatId, messageId })
            return { success: false, error: error.message }
        }
    },

    async sendImage(chatId: string, dataUrl: string, caption?: string, agentId?: string) {
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

            const sessionId = await resolveSessionId(agentId);
            await withWahaRetry('sendImage', sessionId, () =>
                axios.post(`${endpoint}/api/sendImage`, {
                    sessionId: sessionId,
                    chatId: formattedChatId,
                    file: {
                        mimetype: mime,
                        data: base64Data,
                        filename: `image.${ext}`
                    },
                    caption: caption
                }, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 30000
                })
            )
        } catch (error: any) {
            logger.error('WhatsApp sendImage failed', error, { module: 'whatsapp', chatId })
            throw new Error(`Failed to send Image: ${error.message}`)
        }
    },

    async sendVideo(chatId: string, dataUrl: string, caption?: string, agentId?: string) {
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

            const sessionId = await resolveSessionId(agentId);
            await withWahaRetry('sendVideo', sessionId, () =>
                axios.post(`${endpoint}/api/sendVideo`, {
                    sessionId: sessionId,
                    chatId: formattedChatId,
                    file: {
                        mimetype: mime,
                        data: base64Data,
                        filename: `video.${ext}`
                    },
                    caption: caption
                }, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 60000
                })
            )
        } catch (error: any) {
            logger.error('WhatsApp sendVideo failed', error, { module: 'whatsapp', chatId })
            throw new Error(`Failed to send Video: ${error.message}`)
        }
    },

    async getStatus(agentId?: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const sessionId = await resolveSessionId(agentId)
            const url = `${endpoint}/api/sessions/${sessionId}/status`
            const response = await axios.get(url, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
            return response.data
        } catch (e: any) {
            logger.error('WhatsApp status check failed', e, { module: 'whatsapp', agentId })
            if (e.response?.status === 404) return { status: 'OFFLINE', error: 'Session not found' }
            return { status: 'UNREACHABLE', error: e.message }
        }
    },

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

    async markAsRead(chatId: string, agentId?: string, messageKey?: any) {
        // Skip for Discord contacts (no WhatsApp session)
        if (chatId.startsWith('DISCORD_')) {
            return
        }

        const { endpoint, apiKey } = await getConfig()
        const MAX_RETRIES = 3

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
                const payload: any = {
                    sessionId: await resolveSessionId(agentId),
                    chatId: formattedChatId,
                    all: true
                }
                payload.messageKey = messageKey

                await axios.post(`${endpoint}/api/markSeen`, payload, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 5000
                })
                return
            } catch (error: any) {
                if (i === MAX_RETRIES - 1) {
                    logger.error(`MarkRead Failed after ${MAX_RETRIES} attempts`, error, { module: 'whatsapp' })
                } else {
                    await new Promise(r => setTimeout(r, 1000 * (i + 1)))
                }
            }
        }
    },

    async sendTypingState(chatId: string, isTyping: boolean, agentId?: string) {
        const { endpoint, apiKey } = await getConfig()

        // --- DISCORD ROUTING ---
        if (chatId.startsWith('DISCORD_')) {
            const discordEndpoint = process.env.DISCORD_API_ENDPOINT || 'http://localhost:3002'
            const discordUserId = chatId.replace('DISCORD_', '').replace('@discord', '')
            try {
                await axios.post(`${discordEndpoint}/api/sendStateTyping`, {
                    chatId: discordUserId,
                    isTyping
                }, { timeout: 5000 })
                return
            } catch (e: any) {
                logger.error('Discord typing failed', e, { module: 'discord' })
                return
            }
        }
        // -----------------------

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendStateTyping`, {
                sessionId: await resolveSessionId(agentId),
                chatId: formattedChatId,
                isTyping
            }, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
        } catch (error: any) {
            logger.error('TypingStatus Error', error, { module: 'whatsapp' })
        }
    },

    async sendRecordingState(chatId: string, isRecording: boolean, agentId?: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendStateRecording`, {
                sessionId: await resolveSessionId(agentId),
                chatId: formattedChatId,
                isRecording
            }, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
        } catch (error: any) {
            logger.error('RecordingStatus Error', error, { module: 'whatsapp' })
        }
    },

    async adminStatus() {
        const { endpoint, apiKey } = await getConfig()
        try {
            const response = await axios.get(`${endpoint}/status`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
            return { success: true, status: response.data }
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
                // Log l'erreur en DB pour monitoring
                await logWhatsAppError(error, `Failed to connect to ${endpoint}/status`)
                return { success: false, error: 'Service Offline', status: null }
            }
            logger.error('Admin Status Error', error, { module: 'whatsapp' })
            return { success: false, error: error.message, status: null }
        }
    },

    async adminLogs(lines: number = 100) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const response = await axios.get(`${endpoint}/api/logs?lines=${lines}`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
            return {
                success: true,
                lines: (response.data.lines || [])
                    .filter((line: string) => {
                        // Filter out health checks and status pings
                        if (line.includes('GET /api/sessions') && line.includes('200')) return false
                        if (line.includes('GET /dashboard')) return false
                        if (line.includes('GET /api/metrics')) return false
                        return true
                    })
            }
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
                // Log l'erreur en DB pour monitoring
                await logWhatsAppError(error, `Failed to fetch logs from ${endpoint}/api/logs`)
                return { success: false, error: 'Service Offline', lines: [] }
            }
            logger.error('Admin Logs Error', error, { module: 'whatsapp' })
            return { success: false, error: error.message, lines: [] }
        }
    },

    async adminAction(action: string, agentId?: string, options: any = {}) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const response = await axios.post(`${endpoint}/api/admin/action`,
                { action, sessionId: await resolveSessionId(agentId), ...options },
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

    async startSession(agentId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            await axios.post(`${endpoint}/api/sessions/start`, { sessionId: await resolveSessionId(agentId) }, {
                headers: { 'X-Api-Key': apiKey }
            })
            return { success: true }
        } catch (error: any) {
            if (error.response?.status === 409 || error.message?.includes('409')) {
                logger.info(`Session ${agentId} already exists, checking status...`, { module: 'whatsapp' })
                return { success: true, message: 'Session already active' }
            }
            return { success: false, error: error.message }
        }
    },

    async stopSession(agentId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            await axios.post(`${endpoint}/api/sessions/stop`, { sessionId: await resolveSessionId(agentId) }, {
                headers: { 'X-Api-Key': apiKey }
            })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    },

    async deleteSession(agentId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const sessionId = await resolveSessionId(agentId)
            logger.info(`Deleting session permanently`, { module: 'whatsapp', agentId, sessionId })
            await axios.post(`${endpoint}/api/sessions/delete`,
                { sessionId },
                { headers: { 'X-Api-Key': apiKey }, timeout: 10000 }
            )
            return { success: true }
        } catch (error: any) {
            logger.error(`Delete session failed`, error, { module: 'whatsapp', agentId })
            return { success: false, error: error.message }
        }
    }
}
