import axios from 'axios'
import { prisma } from '@/lib/prisma'

// Helper to get config from DB or Env
// Reusing same setting keys (waha_*) to avoid DB migration friction for the user,
// but treating them as 'whatsapp_service' config.
export async function getConfig() {
    try {
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // Endpoint: URL of our new whatsapp-server container (e.g. http://localhost:3001)
        return {
            endpoint: settings.waha_endpoint || process.env.WAHA_ENDPOINT || 'http://localhost:3001',
            apiKey: settings.waha_api_key || process.env.WAHA_API_KEY || 'secret'
        }
    } catch (e) {
        console.warn('Failed to fetch WhatsApp settings from DB, falling back to env/defaults')
        return {
            endpoint: process.env.WAHA_ENDPOINT || 'http://localhost:3001',
            apiKey: process.env.WAHA_API_KEY || 'secret'
        }
    }
}

export const whatsapp = {
    async sendText(chatId: string, text: string) {
        const { endpoint, apiKey } = await getConfig()

        if (!endpoint) {
            console.warn('WHATSAPP_ENDPOINT not configured')
            return { id: 'mock-id' }
        }

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            // Call our new microservice
            const response = await axios.post(`${endpoint}/api/sendText`, {
                chatId: formattedChatId,
                text,
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
            return response.data
        } catch (error: any) {
            console.error('WhatsApp Service SendText Error:', error.message)
            throw new Error(`Failed to send WhatsApp message: ${error.message}`)
        }
    },

    async sendVoice(chatId: string, audioDataUrl: string) {
        const { endpoint, apiKey } = await getConfig()

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            // Extract base64
            const base64Data = audioDataUrl.split(',')[1] || audioDataUrl

            // Call our new microservice's sendVoice endpoint (which handles PTT)
            await axios.post(`${endpoint}/api/sendVoice`, {
                chatId: formattedChatId,
                file: {
                    mimetype: 'audio/mpeg',
                    data: base64Data,
                    filename: 'voice.mp3'
                }
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WhatsApp Service SendVoice Error:', error.message)
            throw new Error(`Failed to send Voice message: ${error.message}`)
        }
    },

    // For compatibility if we need to send images/files later
    async sendFile(chatId: string, fileDataUrl: string, filename: string, caption?: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            const base64Data = fileDataUrl.split(',')[1] || fileDataUrl

            await axios.post(`${endpoint}/api/sendFile`, {
                chatId: formattedChatId,
                file: {
                    mimetype: 'application/octet-stream', // Auto-detect in service or pass correct one
                    data: base64Data,
                    filename: filename
                },
                caption: caption
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WhatsApp Service SendFile Error:', error.message)
            throw new Error(`Failed to send File: ${error.message}`)
        }
    },

    async sendImage(chatId: string, dataUrl: string, caption?: string) {
        // Wrapper for sendFile but simpler
        return this.sendFile(chatId, dataUrl, 'image.jpg', caption)
    },

    async sendVideo(chatId: string, dataUrl: string, caption?: string) {
        // Wrapper for sendFile
        return this.sendFile(chatId, dataUrl, 'video.mp4', caption)
    },

    // Get Status (replaces getSessionStatus)
    async getStatus() {
        const { endpoint } = await getConfig()
        try {
            const response = await axios.get(`${endpoint}/status`)
            return response.data // { status: 'CONNECTED', qr: '...' }
        } catch (e) {
            return { status: 'UNREACHABLE', error: 'Could not connect to WhatsApp Service' }
        }
    },

    // Download Media
    async downloadMedia(messageId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            // New Service Endpoint: GET /api/messages/:msgId/media
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

    async markAsRead(chatId: string) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/markSeen`, { chatId: formattedChatId }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WhatsApp Service MarkRead Error:', error.message)
        }
    },

    async sendTypingState(chatId: string, isTyping: boolean) {
        const { endpoint, apiKey } = await getConfig()
        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendStateTyping`, {
                chatId: formattedChatId,
                isTyping
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WhatsApp Service TypingStatus Error:', error.message)
        }
    }
}
