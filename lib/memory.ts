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

    // Build agent-specific user_id to isolate memories per agent
    buildUserId(phone: string, agentId?: number): string {
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
            console.log(`[Mem0] Memory added for user ${userId}`);
        } catch (error) {
            console.error('[Mem0] Failed to add memory:', error);
        }
    },

    // Agent-specific add: isolates memories per agent
    async addForAgent(phone: string, agentId: number, text: string) {
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
            console.log(`[Mem0] Added ${facts.length} memories for user ${userId}`);
        } catch (error) {
            console.error('[Mem0] Failed to add memories:', error);
        }
    },

    async search(userId: string, query: string) {
        try {
            const client = await this.getClient();
            if (!client) return [];

            const memories = await client.search(query, { user_id: userId });
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
    },

    // Agent-specific getAll
    async getAllForAgent(phone: string, agentId: number) {
        const userId = this.buildUserId(phone, agentId)
        return await this.getAll(userId)
    },

    async deleteAll(userId: string) {
        try {
            const client = await this.getClient();
            if (!client) return;

            await client.deleteAll({ user_id: userId });
            console.log(`[Mem0] All memories deleted for user ${userId}`);
        } catch (error) {
            console.error('[Mem0] Failed to delete all memories:', error);
        }
    }
};

