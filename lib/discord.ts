import axios from 'axios'
import { settingsService } from './settings-cache'

const DISCORD_SERVICE_URL = process.env.DISCORD_SERVICE_URL || 'http://localhost:3002'

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
