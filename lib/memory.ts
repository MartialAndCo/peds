import { MemoryClient } from 'mem0ai';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const memoryService = {
    async getClient() {
        // Fetch API Key from DB or Env
        const settings = await prisma.setting.findUnique({ where: { key: 'mem0_api_key' } });
        const apiKey = settings?.value || process.env.MEM0_API_KEY;

        if (!apiKey) {
            logger.warn('MEM0_API_KEY not configured', { module: 'mem0' });
            return null;
        }

        return new MemoryClient({ apiKey });
    },

    // Build agent-specific user_id to isolate memories per agent
    buildUserId(phone: string, agentId?: string): string {
        if (agentId) {
            return `agent_${agentId}_${phone}`
        }
        return phone
    },

    async add(userId: string, text: string) {
        try {
            const client = await this.getClient();
            if (!client) return;

            await client.add([{ role: "user", content: text }], { user_id: userId });
            logger.info(`Memory added for user ${userId}`, { module: 'mem0', userId, textLength: text.length });
        } catch (error) {
            logger.error('Failed to add memory', error as Error, { module: 'mem0', userId });
        }
    },

    // Agent-specific add: isolates memories per agent
    async addForAgent(phone: string, agentId: string, text: string) {
        const userId = this.buildUserId(phone, agentId)
        await this.add(userId, text)
    },

    // Add multiple facts at once
    async addMany(userId: string, facts: string[]) {
        try {
            const client = await this.getClient();
            if (!client) return;

            for (const fact of facts) {
                await client.add([{ role: "user", content: fact }], { user_id: userId });
            }
            logger.info(`Added ${facts.length} memories for user ${userId}`, { module: 'mem0', userId, count: facts.length });
        } catch (error) {
            logger.error('Failed to add memories', error as Error, { module: 'mem0', userId });
        }
    },

    async search(userId: string, query: string) {
        try {
            const client = await this.getClient();
            if (!client) return [];

            const memories = await client.search(query, { user_id: userId });
            logger.info(`Search returned ${(memories || []).length} results for user ${userId}`, { module: 'mem0', userId, query: query.substring(0, 50) });
            return memories || [];
        } catch (error) {
            logger.error('Failed to search memory', error as Error, { module: 'mem0', userId });
            return [];
        }
    },

    async getAll(userId: string) {
        try {
            const client = await this.getClient();
            if (!client) return [];

            const memories = await client.getAll({ user_id: userId });
            logger.info(`GetAll returned ${(memories || []).length} memories for user ${userId}`, { module: 'mem0', userId });
            return memories || [];
        } catch (error) {
            logger.error('Failed to get all memories', error as Error, { module: 'mem0', userId });
            return [];
        }
    },

    // Agent-specific getAll
    async getAllForAgent(phone: string, agentId: string) {
        const userId = this.buildUserId(phone, agentId)
        return await this.getAll(userId)
    },

    async deleteAll(userId: string) {
        try {
            const client = await this.getClient();
            if (!client) return;

            await client.deleteAll({ user_id: userId });
            logger.info(`All memories deleted for user ${userId}`, { module: 'mem0', userId });
        } catch (error) {
            logger.error('Failed to delete all memories', error as Error, { module: 'mem0', userId });
        }
    }
};

