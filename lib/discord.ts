import axios from 'axios'

const DEFAULT_DISCORD_SERVICE_URL = 'http://localhost:3002'

function getDiscordServiceUrl(): string {
    const rawUrl =
        process.env.DISCORD_SERVICE_URL ||
        process.env.DISCORD_API_ENDPOINT ||
        DEFAULT_DISCORD_SERVICE_URL

    return rawUrl.replace(/\/+$/, '')
}

function normalizeDiscordUserId(userId: string): string {
    return userId.replace(/^DISCORD_/, '').replace(/@discord$/, '')
}

function getErrorDetails(error: unknown) {
    if (!axios.isAxiosError(error)) {
        return { code: undefined, status: undefined, data: undefined as unknown }
    }

    return {
        code: error?.code,
        status: error?.response?.status,
        data: error?.response?.data
    }
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return 'Unknown error'
}

/**
 * Discord API Client
 * 
 * Communicates with services/discord to send messages on Discord.
 * Mirrors the whatsapp.ts client pattern.
 */
export const discord = {
    /**
     * Send a text message to a Discord user
     * @param userId Discord User ID (without DISCORD_ prefix)
     * @param text Message content
     * @param agentId Optional agent ID for multi-agent routing
     */
    async sendText(userId: string, text: string, agentId?: string): Promise<boolean> {
        const cleanUserId = normalizeDiscordUserId(userId)
        const serviceUrl = getDiscordServiceUrl()

        try {
            const response = await axios.post(`${serviceUrl}/api/sendText`, {
                chatId: cleanUserId,
                text,
                sessionId: agentId ? `discord_${agentId}` : 'discord_default'
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            })

            console.log(`[Discord] Sent message to ${cleanUserId}`)
            return response.data?.success === true

        } catch (error: unknown) {
            console.error(
                `[Discord] Failed to send message to ${cleanUserId} via ${serviceUrl}: ${getErrorMessage(error)}`,
                getErrorDetails(error)
            )
            return false
        }
    },

    /**
     * Send an image to a Discord user
     */
    async sendImage(userId: string, url: string, caption?: string, agentId?: string): Promise<boolean> {
        const cleanUserId = normalizeDiscordUserId(userId)
        const serviceUrl = getDiscordServiceUrl()
        try {
            const response = await axios.post(`${serviceUrl}/api/sendImage`, {
                chatId: cleanUserId,
                image: { url }, // Wrapper to match WAHA/Baileys structure often used
                caption: caption || '',
                sessionId: agentId ? `discord_${agentId}` : 'discord_default'
            }, {
                timeout: 60000
            })
            return response.data?.success === true
        } catch (error: unknown) {
            console.error(
                `[Discord] Failed to send image to ${cleanUserId} via ${serviceUrl}: ${getErrorMessage(error)}`,
                getErrorDetails(error)
            )
            return false
        }
    },

    /**
     * Send a general file to a Discord user
     */
    async sendFile(userId: string, url: string, filename: string, caption?: string, agentId?: string): Promise<boolean> {
        const cleanUserId = normalizeDiscordUserId(userId)
        const serviceUrl = getDiscordServiceUrl()
        try {
            // For now mapping sendFile to sendImage/sendText or generic endpoint if available
            // Assuming the Discord service has a similar generic 'sendFile' or we use sendImage for now if it's media
            // If strictly file, we might need a specific endpoint. 
            // Attempting /api/sendFile if it exists, otherwise falling back or logging.
            // PROCEEDING with /api/sendFile assumption based on pattern.
            const response = await axios.post(`${serviceUrl}/api/sendFile`, {
                chatId: cleanUserId,
                file: { url, filename },
                caption: caption || '',
                sessionId: agentId ? `discord_${agentId}` : 'discord_default'
            }, {
                timeout: 60000
            })
            return response.data?.success === true
        } catch (error: unknown) {
            console.error(
                `[Discord] Failed to send file to ${cleanUserId} via ${serviceUrl}: ${getErrorMessage(error)}`,
                getErrorDetails(error)
            )
            return false
        }
    },

    /**
     * Send typing indicator to Discord user
     * Note: Discord.js handles this automatically in most cases
     */
    async sendTypingState(userId: string, isTyping: boolean, agentId?: string): Promise<boolean> {
        void userId
        void isTyping
        void agentId
        // For now, typing is handled automatically by discord.js-selfbot-v13
        // This is a placeholder for future implementation if needed
        return true
    },

    /**
     * Check if Discord service is healthy
     */
    async isHealthy(): Promise<boolean> {
        const serviceUrl = getDiscordServiceUrl()
        try {
            const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 })
            return response.data?.status === 'ok' && response.data?.discord === 'connected'
        } catch {
            return false
        }
    }
}
