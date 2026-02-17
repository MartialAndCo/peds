import axios from 'axios'
import { settingsService } from './settings-cache'

// Same logic as whatsapp.ts - hardcoded EC2 IP for production
const DISCORD_SERVICE_URL = process.env.DISCORD_SERVICE_URL || 'http://13.60.16.81:3002'

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
        // Strip DISCORD_ prefix if present
        const cleanUserId = userId.replace('DISCORD_', '').replace('@discord', '')

        try {
            const response = await axios.post(`${DISCORD_SERVICE_URL}/api/sendText`, {
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

        } catch (error: any) {
            console.error(`[Discord] Failed to send message to ${cleanUserId}:`, error.message)
            return false
        }
    },

    /**
     * Send an image to a Discord user
     */
    async sendImage(userId: string, url: string, caption?: string, agentId?: string): Promise<boolean> {
        const cleanUserId = userId.replace('DISCORD_', '').replace('@discord', '')
        try {
            const response = await axios.post(`${DISCORD_SERVICE_URL}/api/sendImage`, {
                chatId: cleanUserId,
                image: { url }, // Wrapper to match WAHA/Baileys structure often used
                caption: caption || '',
                sessionId: agentId ? `discord_${agentId}` : 'discord_default'
            }, {
                timeout: 60000
            })
            return response.data?.success === true
        } catch (error: any) {
            console.error(`[Discord] Failed to send image to ${cleanUserId}:`, error.message)
            return false
        }
    },

    /**
     * Send a general file to a Discord user
     */
    async sendFile(userId: string, url: string, filename: string, caption?: string, agentId?: string): Promise<boolean> {
        const cleanUserId = userId.replace('DISCORD_', '').replace('@discord', '')
        try {
            // For now mapping sendFile to sendImage/sendText or generic endpoint if available
            // Assuming the Discord service has a similar generic 'sendFile' or we use sendImage for now if it's media
            // If strictly file, we might need a specific endpoint. 
            // Attempting /api/sendFile if it exists, otherwise falling back or logging.
            // PROCEEDING with /api/sendFile assumption based on pattern.
            const response = await axios.post(`${DISCORD_SERVICE_URL}/api/sendFile`, {
                chatId: cleanUserId,
                file: { url, filename },
                caption: caption || '',
                sessionId: agentId ? `discord_${agentId}` : 'discord_default'
            }, {
                timeout: 60000
            })
            return response.data?.success === true
        } catch (error: any) {
            console.error(`[Discord] Failed to send file to ${cleanUserId}:`, error.message)
            return false
        }
    },

    /**
     * Send typing indicator to Discord user
     * Note: Discord.js handles this automatically in most cases
     */
    async sendTypingState(userId: string, isTyping: boolean, agentId?: string): Promise<boolean> {
        // For now, typing is handled automatically by discord.js-selfbot-v13
        // This is a placeholder for future implementation if needed
        return true
    },

    /**
     * Check if Discord service is healthy
     */
    async isHealthy(): Promise<boolean> {
        try {
            const response = await axios.get(`${DISCORD_SERVICE_URL}/health`, { timeout: 5000 })
            return response.data?.status === 'ok' && response.data?.discord === 'connected'
        } catch {
            return false
        }
    }
}
