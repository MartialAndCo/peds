/**
 * Memory Extraction Service
 * 
 * Periodically analyzes conversations and extracts important facts/anecdotes
 * to store in Mem0 for long-term memory.
 * 
 * Features:
 * - Agent-isolated memories (each agent has its own memory space per user)
 * - AI-powered fact extraction
 * - Tracks last extraction timestamp to only process new messages
 */

import { prisma } from '@/lib/prisma'
import { memoryService } from '@/lib/memory'
import { venice } from '@/lib/venice'
import { settingsService } from '@/lib/settings-cache'
import { memorySignalBridge } from './memory-signal-bridge'

const EXTRACTION_PROMPT = `You are a memory extraction system. Analyze this conversation and extract IMPORTANT FACTS about the user.

Extract ONLY concrete, useful information such as:
- Personal info: name, age, birthday, location
- Work: job, company, schedule
- Interests: hobbies, favorite things, preferences
- Relationships: family members, pets, friends mentioned
- Anecdotes: memorable stories, funny moments, significant events shared
- Plans: upcoming events, goals, wishes mentioned

RULES:
- Each fact should be a complete, standalone sentence
- Use third person (e.g., "User's name is Marc" not "Your name is Marc")
- Only extract facts ABOUT THE USER, not about yourself (the AI)
- Be specific (e.g., "User has a golden retriever named Pixel" not "User has a pet")
- Extract anecdotes as brief summaries (e.g., "User got stuck in elevator last week")
- If no useful facts found, return empty array

CONVERSATION:
{CONVERSATION}

Output as a valid JSON array of strings:
["fact 1", "fact 2", "anecdote 1"]`

export const memoryExtractionService = {
    /**
     * Process all active conversations and extract facts
     */
    async runExtraction(): Promise<{ processed: number; factsExtracted: number }> {
        console.log('[MemoryExtraction] Starting periodic extraction...')

        const settings = await settingsService.getSettings()
        let processed = 0
        let factsExtracted = 0

        // Get all agents
        const agents = await prisma.agent.findMany({
            select: { id: true, name: true }
        })

        for (const agent of agents) {
            console.log(`[MemoryExtraction] Processing Agent: ${agent.name} (ID: ${agent.id})`)

            // Fetch agent-specific settings for the current agent
            const agentSettings = await prisma.agentSetting.findMany({
                where: { agentId: (agent.id as unknown as string) || 'default' }
            })

            // Get active conversations for this agent that haven't been analyzed recently
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

            const conversations = await prisma.conversation.findMany({
                where: {
                    agentId: agent.id,
                    status: { in: ['active', 'paused'] },
                    OR: [
                        { lastMemoryExtraction: null },
                        { lastMemoryExtraction: { lt: sixHoursAgo } }
                    ]
                },
                include: {
                    contact: true,
                    messages: {
                        orderBy: { timestamp: 'desc' },
                        take: 30 // Last 30 messages for context
                    }
                }
            })

            console.log(`[MemoryExtraction] Found ${conversations.length} conversations to analyze`)

            for (const conv of conversations) {
                try {
                    // Filter to only new messages since last extraction
                    const lastExtraction = conv.lastMemoryExtraction || new Date(0)
                    const newMessages = conv.messages
                        .filter(m => new Date(m.timestamp) > lastExtraction)
                        .reverse() // Chronological order

                    if (newMessages.length === 0) {
                        console.log(`[MemoryExtraction] No new messages for conv ${conv.id}, skipping`)
                        continue
                    }

                    // Format conversation for AI
                    const formattedConv = newMessages
                        .map(m => `${m.sender === 'contact' ? 'User' : 'AI'}: ${m.message_text}`)
                        .join('\n')

                    // Extract facts using AI
                    const facts = await this.extractFacts(formattedConv, settings)

                    if (facts.length > 0) {
                        // Store facts in Mem0 with agent-specific user_id
                        const phone = conv.contact.phone_whatsapp || ''
                        const userId = memoryService.buildUserId(phone, agent.id as unknown as string)
                        await memoryService.addMany(userId, facts)
                        factsExtracted += facts.length
                        console.log(`[MemoryExtraction] Stored ${facts.length} facts for ${phone}`)
                        
                        // 🔥 NOUVEAU: Détecter signaux implicites dans les mémoires
                        try {
                            await memorySignalBridge.onMemoryExtraction(
                                agent.id as unknown as string,
                                conv.contact.id,
                                facts
                            )
                        } catch (e) {
                            console.error('[MemoryExtraction] Signal bridge failed:', e)
                        }
                    }

                    // Update last extraction timestamp
                    await prisma.conversation.update({
                        where: { id: conv.id },
                        data: { lastMemoryExtraction: new Date() }
                    })

                    processed++
                } catch (e) {
                    console.error(`[MemoryExtraction] Failed for conv ${conv.id}:`, e)
                }
            }
        }

        console.log(`[MemoryExtraction] Complete. Processed: ${processed}, Facts: ${factsExtracted}`)
        return { processed, factsExtracted }
    },

    /**
     * Extract facts from a conversation using AI
     */
    async extractFacts(conversation: string, settings: any): Promise<string[]> {
        const prompt = EXTRACTION_PROMPT.replace('{CONVERSATION}', conversation)

        try {
            // Use Venice (with fallback chain to OpenRouter/RunPod)
            const response = await venice.chatCompletion(
                'You are a memory extraction AI. Output only valid JSON.',
                [],
                prompt,
                {
                    apiKey: settings.venice_api_key,
                    model: settings.venice_model || 'venice-uncensored',
                    temperature: 0.3, // Low temperature for consistency
                    max_tokens: 500
                }
            )

            // Parse JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                const facts = JSON.parse(jsonMatch[0])
                if (Array.isArray(facts)) {
                    return facts.filter(f => typeof f === 'string' && f.trim().length > 0)
                }
            }

            return []
        } catch (e) {
            console.error('[MemoryExtraction] AI extraction failed:', e)
            return []
        }
    }
}
