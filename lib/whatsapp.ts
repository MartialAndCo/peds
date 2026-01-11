import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Helper to get config from DB or Env
export async function getConfig() {
    try {
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        const defaultEndpoint = 'http://127.0.0.1:3001'

        return {
            endpoint: settings.waha_endpoint || process.env.WAHA_ENDPOINT || defaultEndpoint,
            apiKey: process.env.AUTH_TOKEN || settings.waha_api_key || process.env.WAHA_API_KEY || 'secret',
            webhookSecret: process.env.WEBHOOK_SECRET
        }
    } catch (e) {
        logger.warn('Failed to fetch WhatsApp settings from DB, falling back to env/defaults', { module: 'whatsapp' })
        return {
            endpoint: process.env.WAHA_ENDPOINT || 'http://127.0.0.1:3001',
            apiKey: process.env.AUTH_TOKEN || process.env.WAHA_API_KEY || 'secret',
            webhookSecret: process.env.WEBHOOK_SECRET
        }
    }
}

export const whatsapp = {
    async sendText(chatId: string, text: string, replyTo?: string, agentId?: number) {
        const textPreview = text.substring(0, 50) + (text.length > 50 ? '...' : '')
        logger.info('Sending text message', { module: 'whatsapp', chatId, textPreview, agentId })
        const { endpoint, apiKey } = await getConfig()

        if (!endpoint) {
            logger.warn('WHATSAPP_ENDPOINT not configured', { module: 'whatsapp' })
            return { id: 'mock-id' }
        }

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            // Call our new microservice
            const response = await axios.post(`${endpoint}/api/sendText`, {
                sessionId: agentId?.toString(), // Pass Agent ID as Session ID
                chatId: formattedChatId,
                text,
                replyTo
            }, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 15000 // 15s timeout
            })
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
            const base64Data = audioDataUrl.split(',')[1] || audioDataUrl

            await axios.post(`${endpoint}/api/sendVoice`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId,
                file: {
                    mimetype: 'audio/mpeg',
                    data: base64Data,
                    filename: 'voice.mp3'
                },
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

    async sendImage(chatId: string, dataUrl: string, caption?: string, agentId?: number) {
        return this.sendFile(chatId, dataUrl, 'image.jpg', caption, agentId)
    },

    async sendVideo(chatId: string, dataUrl: string, caption?: string, agentId?: number) {
        return this.sendFile(chatId, dataUrl, 'video.mp4', caption, agentId)
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
            console.log(`[WhatsApp] Resetting session: ${sessionId}`)
            const response = await axios.post(`${endpoint}/api/sessions/reset`,
                { sessionId },
                { headers: { 'X-Api-Key': apiKey }, timeout: 10000 }
            )
            return response.data
        } catch (e: any) {
            console.error(`[WhatsApp] Reset Failed:`, e.message)
            throw new Error(e.response?.data?.error || e.message)
        }
    },

    // Download Media (No agentId needed usually, cached global or by ID)
    async downloadMedia(messageId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const url = `${endpoint}/api/messages/${messageId}/media`
            console.log(`[WhatsAppClient] Downloading media from: ${url}`)

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
            console.error('WhatsApp Service Download Media Error:', error.message)
            return null
        }
    },

    async markAsRead(chatId: string, agentId?: number) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/markSeen`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WhatsApp Service MarkRead Error:', error.message)
        }
    },

    async sendTypingState(chatId: string, isTyping: boolean, agentId?: number) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendStateTyping`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId,
                isTyping
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WhatsApp Service TypingStatus Error:', error.message)
        }
    },

    async sendRecordingState(chatId: string, isRecording: boolean, agentId?: number) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendStateRecording`, {
                sessionId: agentId?.toString(),
                chatId: formattedChatId,
                isRecording
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WhatsApp Service RecordingStatus Error:', error.message)
        }
    },

    async adminStatus() {
        const { endpoint, apiKey } = await getConfig()
        try {
            const response = await axios.get(`${endpoint}/api/admin/status`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
            return response.data
        } catch (error: any) {
            console.error('WhatsApp Admin Status Error:', error.message)
            return { success: false, error: error.message, status: null }
        }
    },

    async adminLogs(lines: number = 100) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const response = await axios.get(`${endpoint}/api/admin/logs?lines=${lines}`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 5000
            })
            return response.data
        } catch (error: any) {
            console.error('WhatsApp Admin Logs Error:', error.message)
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
            console.error('WhatsApp Admin Action Error:', error.message)
            return { success: false, error: error.message }
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
            console.log(`[WhatsApp] Deleting session permanently: ${agentId}`)
            await axios.post(`${endpoint}/api/sessions/delete`,
                { sessionId: agentId },
                { headers: { 'X-Api-Key': apiKey }, timeout: 10000 }
            )
            return { success: true }
        } catch (error: any) {
            console.error(`[WhatsApp] Delete session failed:`, error.message)
            return { success: false, error: error.message }
        }
    }
}
