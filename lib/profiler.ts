import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { settingsService } from '@/lib/settings-cache'

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
        
        if (messages.length === 0) {
            console.log(`[Profiler] No messages for contact ${contactId}, skipping`)
            return
        }
        
        const history = messages.reverse().map(m => `${m.sender}: ${m.message_text}`).join('\n')

        // 1b. Get existing profile for merging
        const existingContact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { profile: true, name: true }
        })
        const existingProfile = (existingContact?.profile as any) || {}

        // 2. Ask AI to extract (from DB)
        const settings = await settingsService.getSettings()

        const defaultPrompt = `You are a data extractor. Analyze the conversation history and extract the user's profile information.
        
        Output strictly valid JSON with this exact structure:
        {
            "name": "User's extracted name or nickname (or null if not mentioned)",
            "age": number or null,
            "job": "User's job/profession (or null if not mentioned)",
            "location": "User's city/location (or null if not mentioned)",
            "notes": "Any other key details: hobbies, car, family, pets, etc. Be specific! (or empty string)",
            "intent": "What does he want? dating, friendship, pics, casual chat, etc. (or null)"
        }
        
        RULES:
        - If information is missing, use null (not "null" string)
        - Age should be a number, not a string
        - Do NOT invent information
        - Be specific in notes: "has a golden retriever" not just "has a pet"
        - Output ONLY the JSON, no markdown, no explanation`;

        const systemPrompt = settings.prompt_profiler_extraction || defaultPrompt;

        try {
            const result = await venice.chatCompletion(
                systemPrompt,
                [],
                `Conversation:\n${history}\n\nExtract Profile JSON:`,
                { apiKey: settings.venice_api_key, model: settings.venice_model }
            )

            // Parse JSON with more robust extraction
            const profileData = extractJsonFromResponse(result)
            if (!profileData) {
                console.log(`[Profiler] No valid JSON found in response for ${contactId}`)
                return
            }

            // 3. Merge with existing profile - only overwrite non-null values
            // Keep existing values if new extraction returns null
            const mergedProfile = {
                name: profileData.name ?? existingProfile.name ?? null,
                age: profileData.age ?? existingProfile.age ?? null,
                job: profileData.job ?? existingProfile.job ?? null,
                location: profileData.location ?? existingProfile.location ?? null,
                notes: mergeNotes(existingProfile.notes, profileData.notes),
                intent: profileData.intent ?? existingProfile.intent ?? null,
                // Keep extraction timestamp
                lastExtracted: new Date().toISOString()
            }

            const existingName = (existingContact?.name || '').trim()
            const extractedName = typeof profileData.name === 'string' ? profileData.name.trim() : ''
            const isUnknownExisting = !existingName || /^(inconnu|unknown|discord user)$/i.test(existingName)
            const nextName = isUnknownExisting ? (extractedName || existingName || null) : (existingName || null)

            await prisma.contact.update({
                where: { id: contactId },
                data: { 
                    profile: mergedProfile,
                    // Update name if it's unknown/empty and we extracted a valid name
                    name: nextName
                }
            })

            console.log(`[Profiler] Updated profile for ${contactId}:`, mergedProfile)
            return mergedProfile

        } catch (e) {
            console.error('[Profiler] Extraction failed:', e)
            throw e
        }
    }
}

/**
 * Extract JSON object from AI response, handling various formats
 */
function extractJsonFromResponse(response: string): any | null {
    if (!response || response.length < 2) return null
    
    // Try to find JSON object in the response
    const patterns = [
        /\{[\s\S]*\}/,  // Match {...}
        /```json\s*([\s\S]*?)```/,  // Match ```json ... ```
        /```\s*([\s\S]*?)```/,  // Match ``` ... ```
    ]
    
    for (const pattern of patterns) {
        const match = response.match(pattern)
        if (match) {
            const jsonStr = match[1] || match[0]
            try {
                return JSON.parse(jsonStr.trim())
            } catch (e) {
                // Try next pattern
            }
        }
    }
    
    // Try parsing the whole response as JSON
    try {
        return JSON.parse(response.trim())
    } catch (e) {
        console.error('[Profiler] Failed to parse JSON from:', response.substring(0, 200))
        return null
    }
}

/**
 * Merge notes - append new info to existing notes
 */
function mergeNotes(existing: string | null, newNotes: string | null): string {
    const existingStr = existing || ''
    const newStr = newNotes || ''
    
    if (!existingStr) return newStr
    if (!newStr) return existingStr
    
    // Simple deduplication - if new notes contain existing content, just return new
    if (newStr.includes(existingStr)) return newStr
    
    // Otherwise combine with separator
    return `${existingStr}; ${newStr}`.substring(0, 1000) // Limit length
}
