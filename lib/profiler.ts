import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'

export const profilerService = {
    /**
     * Analyze conversation history to extract user profile info.
     * Updates the Contact's profile field.
     */
    async updateProfile(contactId: string) {
        // 1. Get History (Last 50 messages)
        const conversation = await prisma.conversation.findFirst({
            where: { contactId },
            orderBy: { createdAt: 'desc' }
        })

        if (!conversation) return

        const messages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { timestamp: 'desc' },
            take: 50
        })
        const history = messages.reverse().map(m => `${m.sender}: ${m.message_text}`).join('\n')

        // 2. Ask AI to extract (from DB)
        const settings = await settingsService.getSettings()

        const defaultPrompt = `You are a data extractor. Analyze the conversation history and extract the user's profile information.
        
        Output strictly valid JSON:
        {
            "name": "User's extracted name or nickname (or null)",
            "age": "User's age (or null)",
            "job": "User's job/profession (or null)",
            "location": "User's city/location (or null)",
            "notes": "Any other key details (hobbies, car, etc)",
            "intent": "What does he want? (e.g. date, pics, chat)"
        }
        
        If information is missing, use null. do NOT invent.`;

        const systemPrompt = settings.prompt_profiler_extraction || defaultPrompt;

        try {
            const provider = settings.ai_provider || 'venice';
            let result = "";
            if (provider === 'anthropic') {
                const { anthropic } = require('@/lib/anthropic')
                result = await anthropic.chatCompletion(systemPrompt, [], `Conversation:\n${history}\n\nExtract Profile JSON:`, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model })
            } else {
                result = await venice.chatCompletion(systemPrompt, [], `Conversation:\n${history}\n\nExtract Profile JSON:`, { apiKey: settings.venice_api_key, model: settings.venice_model })
            }

            // Clean Markdown code blocks if present
            const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim()
            if (!cleanJson || cleanJson.length < 2) return

            const profileData = JSON.parse(cleanJson)

            // 3. Update Contact
            // Merge with existing profile? Or overwrite? 
            // Profiler overwrites because it sees full history (up to 50).
            // Better: Merge. But simplistic approach is overwrite with latest extraction.

            await prisma.contact.update({
                where: { id: contactId },
                data: { profile: profileData }
            })

            console.log(`[Profiler] Updated profile for ${contactId}:`, profileData)

        } catch (e) {
            console.error('[Profiler] Extraction failed:', e)
        }
    }
}
