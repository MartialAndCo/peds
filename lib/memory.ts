import { MemoryClient } from 'mem0ai';
import { prisma } from '@/lib/prisma';

export const memoryService = {
    async getClient() {
        // Fetch API Key from DB or Env
        const settings = await prisma.setting.findUnique({ where: { key: 'mem0_api_key' } });
        const apiKey = settings?.value || process.env.MEM0_API_KEY;

        if (!apiKey) {
            console.warn('MEM0_API_KEY not configured.');
            return null;
        }

        return new MemoryClient({ apiKey });
    },

    async add(userId: string, text: string) {
        try {
            const client = await this.getClient();
            if (!client) return;

            // Mem0 'add' takes messages or text.
            // Using userId as the unique identifier for the memory scope.
            await client.add(text, { user_id: userId });
            console.log(`[Mem0] Memory added for user ${userId}`);
        } catch (error) {
            console.error('[Mem0] Failed to add memory:', error);
        }
    },

    async search(userId: string, query: string) {
        try {
            const client = await this.getClient();
            if (!client) return [];

            const memories = await client.search(query, { user_id: userId });
            // Structure depends on Mem0 response, usually list of objects with 'memory' text
            return memories || [];
        } catch (error) {
            console.error('[Mem0] Failed to search memory:', error);
            return [];
        }
    },

    async getAll(userId: string) {
        try {
            const client = await this.getClient();
            if (!client) return [];

            const memories = await client.getAll({ user_id: userId });
            return memories || [];
        } catch (error) {
            console.error('[Mem0] Failed to get all memories:', error);
            return [];
        }
    }
};
