import axios from 'axios'
import { prisma } from '@/lib/prisma'


// Helper to get config from DB or Env
export async function getConfig() {
    try {
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        return {
            endpoint: settings.waha_endpoint || process.env.WAHA_ENDPOINT || 'http://localhost:3001',
            session: settings.waha_session || process.env.WAHA_SESSION || 'default',
            apiKey: settings.waha_api_key || process.env.WAHA_API_KEY || 'secret'
        }
    } catch (e) {
        console.warn('Failed to fetch WAHA settings from DB, falling back to env/defaults')
        return {
            endpoint: process.env.WAHA_ENDPOINT || 'http://localhost:3001',
            session: process.env.WAHA_SESSION || 'default',
            apiKey: process.env.WAHA_API_KEY || 'secret'
        }
    }
}

export const waha = {
    async sendText(chatId: string, text: string) {
        const { endpoint, session, apiKey } = await getConfig()

        if (!endpoint) {
            console.warn('WAHA_ENDPOINT not configured')
            return { id: 'mock-id' }
        }

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`

            const response = await axios.post(`${endpoint}/api/sendText`, {
                session,
                chatId: formattedChatId,
                text,
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
            return response.data
        } catch (error: any) {
            const errorDetails = JSON.stringify(error.response?.data || error.message)
            console.error('WAHA Send Error:', errorDetails)
            throw new Error(`Failed to send WhatsApp message: ${errorDetails}`)
        }
    },

    async sendSeen(chatId: string) {
        const { endpoint, session, apiKey } = await getConfig()

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/sendSeen`, {
                session,
                chatId: formattedChatId,
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WAHA SendSeen Error:', error.response?.data || error.message)
        }
    },

    async startTyping(chatId: string) {
        const { endpoint, session, apiKey } = await getConfig()

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/startTyping`, {
                session,
                chatId: formattedChatId,
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WAHA StartTyping Error:', error.response?.data || error.message)
        }
    },

    async stopTyping(chatId: string) {
        const { endpoint, session, apiKey } = await getConfig()

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            await axios.post(`${endpoint}/api/stopTyping`, {
                session,
                chatId: formattedChatId,
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            console.error('WAHA StopTyping Error:', error.response?.data || error.message)
        }
    },

    async sendSafeReply(chatId: string, text: string) {
        // 1. Random delay before "Seeing" (1-3s)
        const readingDelay = Math.floor(Math.random() * 2000) + 1000
        await new Promise(resolve => setTimeout(resolve, readingDelay))

        await this.sendSeen(chatId)

        // 2. Random delay before "Typing" (1-3s)
        const thinkingDelay = Math.floor(Math.random() * 2000) + 1000
        await new Promise(resolve => setTimeout(resolve, thinkingDelay))

        await this.startTyping(chatId)

        // 3. Typing delay based on length (50ms per char), min 2s, max 10s
        const typingDuration = Math.min(Math.max(text.length * 50, 2000), 10000)
        await new Promise(resolve => setTimeout(resolve, typingDuration))

        await this.stopTyping(chatId)

        return await this.sendText(chatId, text)
    },

    async getSessionStatus() {
        const { endpoint, apiKey } = await getConfig()

        try {
            const response = await axios.get(`${endpoint}/api/sessions?all=true`, {
                headers: { 'X-Api-Key': apiKey }
            })
            return response.data
        } catch (e) {
            return []
        }
    },

    async sendFile(chatId: string, fileDataUrl: string, filename: string, caption?: string) {
        const { endpoint, session, apiKey } = await getConfig()

        try {
            const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
            const base64Data = fileDataUrl.split(',')[1] || fileDataUrl

            await axios.post(`${endpoint}/api/sendFile`, {
                session,
                chatId: formattedChatId,
                file: {
                    mimetype: 'audio/mpeg',
                    data: base64Data,
                    filename: filename
                },
                caption: caption
            }, {
                headers: { 'X-Api-Key': apiKey }
            })
        } catch (error: any) {
            const errorDetails = JSON.stringify(error.response?.data || error.message)
            console.error('WAHA SendFile Error:', errorDetails)
            throw new Error(`Failed to send File: ${errorDetails}`)
        }
    },

    async sendVoice(chatId: string, audioDataUrl: string) {
        // NOTE: WAHA 'sendVoice' (PTT) is often restricted to Plus version.
        // We will try to use 'sendFile' as a fallback which works on Free version usually.
        // Ideally we try sendVoice, catch 422, then sendFile.
        const { endpoint, session, apiKey } = await getConfig()
        const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace('+', '')}@c.us`
        const base64Data = audioDataUrl.split(',')[1] || audioDataUrl

        try {
            // Try native Voice Note (PTT)
            await axios.post(`${endpoint}/api/sendVoice`, {
                session,
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
            console.warn('WAHA SendVoice failed (likely Plus-only feature). Falling back to SendFile...', error.response?.status)
            
            // Fallback to sending as Audio File
            try {
                await this.sendFile(chatId, audioDataUrl, 'voice.mp3', '')
                console.log('Fallback to SendFile successful')
            } catch (fallbackError: any) {
                const errorDetails = JSON.stringify(fallbackError.response?.data || fallbackError.message)
                console.error('WAHA SendFile Fallback Error:', errorDetails)
                throw new Error(`Failed to send Voice message (and fallback failed): ${errorDetails}`)
            }
        }
    },

    async downloadMedia(messageId: string, chatId: string) {
        const { endpoint, session, apiKey } = await getConfig()

        try {
            const encodedChatId = encodeURIComponent(chatId)
            const encodedMsgId = encodeURIComponent(messageId)

            const messageUrl = `${endpoint}/api/${session}/chats/${encodedChatId}/messages/${encodedMsgId}`
            console.log(`[WAHA] Fetching message details: ${messageUrl}`)

            const msgResponse = await axios.get(messageUrl, {
                headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' }
            })

            const mediaUrl = msgResponse.data?.media?.url
            if (!mediaUrl) {
                console.error('[WAHA] No media.url found in message details')
                return null
            }

            // FIX: Always rewrite the media URL to use the configured endpoint.
            // This ensures that whether WAHA returns localhost, internal IP, or anything else,
            // we try to access it via the known-working endpoint URL.
            let finalUrl = mediaUrl
            try {
                const mediaUrlObj = new URL(mediaUrl)
                const endpointObj = new URL(endpoint)

                // Keep the path (e.g. /api/files/...) but replace protocol/host/port with endpoint's
                mediaUrlObj.protocol = endpointObj.protocol
                mediaUrlObj.host = endpointObj.host
                mediaUrlObj.port = endpointObj.port

                finalUrl = mediaUrlObj.toString()
                console.log(`[WAHA] Rewrote media URL from '${mediaUrl}' to '${finalUrl}'`)
            } catch (e) {
                console.warn('[WAHA] Failed to rewrite media URL, using original:', e)
            }

            console.log(`[WAHA] Downloading media from: ${finalUrl}`)
            const response = await axios.get(finalUrl, {
                headers: { 'X-Api-Key': apiKey },
                responseType: 'arraybuffer'
            })

            const mimetype = response.headers['content-type']
            return {
                mimetype,
                data: Buffer.from(response.data)
            }
        } catch (error: any) {
            console.error('WAHA Download Media Error:', error.message)
            if (error.response) {
                console.error('Response Status:', error.response.status)
                console.error('Response Data:', JSON.stringify(error.response.data))
            }
            return null
        }
    }
}

