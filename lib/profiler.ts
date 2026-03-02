import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { settingsService } from '@/lib/settings-cache'

export const profilerService = {
    /**
     * Analyze conversation history to extract user profile info.
     * Updates the Contact's profile field.
     */
    async updateProfile(contactId: string) {
        // 1. Get History (ALL messages from contact)
        const conversation = await prisma.conversation.findFirst({
            where: { contactId },
            orderBy: { createdAt: 'desc' }
        })

        if (!conversation) return

        // Fetch ALL messages but ONLY from the contact (to save tokens & focus on their statements)
        const messages = await prisma.message.findMany({
            where: {
                conversationId: conversation.id,
                sender: 'contact'
            },
            orderBy: { timestamp: 'asc' } // Send in chronological order
        })

        if (messages.length === 0) {
            console.log(`[Profiler] No messages from contact ${contactId}, skipping`)
            return
        }

        const history = messages.map(m => `- ${m.message_text}`).join('\n')

        // 1b. Get existing profile & initial admin notes for context
        const existingContact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { profile: true, name: true, notes: true, phone_whatsapp: true }
        })
        const existingProfile = (existingContact?.profile as any) || {}
        const initialNotes = existingContact?.notes || ''
        const contactPhone = existingContact?.phone_whatsapp || ''

        // 2. Ask AI to extract (from DB)
        const settings = await settingsService.getSettings()

        const defaultPrompt = `Tu es un expert en extraction de données. Ton but est d'analyser l'historique complet des messages envoyés par cet utilisateur, ainsi que le contexte/notes de l'administrateur, pour extraire un profil complet.
        
        ${initialNotes ? `[NOTES DE L'ADMIN / CONTEXTE INITIAL] :\n${initialNotes}\n` : ''}
        [NUMÉRO DE TÉLÉPHONE CONNU] : ${contactPhone}

        Renvoie STRICTEMENT un JSON valide avec cette structure exacte :
        {
            "firstName": "Prénom de l'utilisateur (ou null)",
            "lastName": "Nom de famille de l'utilisateur (ou null)",
            "age": nombre ou null,
            "phone": "Numéro de téléphone de l'utilisateur (ou null)",
            "city": "Ville de résidence (ou null)",
            "country": "Pays de résidence (ou null)",
            "job": "Profession, travail ou études (ou null)",
            "familySituation": "Situation familiale (ex: célibataire, marié, 2 enfants, etc.) (ou null)",
            "intent": "Que cherche-t-il sur la plateforme ? (amitié, amour, photos, etc.)",
            "notes": "Autres détails importants : passions, type de véhicule, traits de caractère, détails physiques (ou chaîne vide)"
        }
        
        RÈGLES CRITIQUES :
        - S'il manque une info, utilise la vraie valeur JSON null (pas le mot "null" entre guillemets).
        - L'âge doit être un entier numérique (ex: 25).
        - N'invente AUCUNE information qui n'apparaît pas dans la conversation ou les notes admin.
        - Ne renvoie QUE le JSON, aucun markdown \`\`\`json, aucun texte autour.`;

        const systemPrompt = settings.prompt_profiler_extraction || defaultPrompt;

        try {
            const result = await venice.chatCompletion(
                systemPrompt,
                [],
                `[MESSAGES DE L'UTILISATEUR] :\n${history}\n\nExtrais le profil JSON :`,
                { apiKey: settings.venice_api_key, model: settings.venice_model, max_tokens: 1000 }
            )

            // Parse JSON with more robust extraction
            const profileData = extractJsonFromResponse(result)
            if (!profileData) {
                console.log(`[Profiler] No valid JSON found in response for ${contactId}`)
                return
            }

            // 3. Merge with existing profile - only overwrite non-null values
            const mergedProfile = {
                firstName: profileData.firstName ?? profileData.name ?? existingProfile.firstName ?? existingProfile.name ?? null,
                lastName: profileData.lastName ?? existingProfile.lastName ?? null,
                age: profileData.age ?? existingProfile.age ?? null,
                phone: profileData.phone ?? existingProfile.phone ?? contactPhone ?? null,
                city: profileData.city ?? profileData.location ?? existingProfile.city ?? existingProfile.location ?? null,
                country: profileData.country ?? existingProfile.country ?? null,
                job: profileData.job ?? existingProfile.job ?? null,
                familySituation: profileData.familySituation ?? existingProfile.familySituation ?? null,
                notes: mergeNotes(existingProfile.notes, profileData.notes),
                intent: profileData.intent ?? existingProfile.intent ?? null,
                // Keep extraction timestamp
                lastExtracted: new Date().toISOString()
            }

            const existingName = (existingContact?.name || '').trim()
            const extractedName = (profileData.firstName || '').trim()
            const isUnknownExisting = !existingName || /^(inconnu|unknown|discord user)$/i.test(existingName)
            const nextName = isUnknownExisting ? (extractedName || existingName || null) : (existingName || null)

            await prisma.contact.update({
                where: { id: contactId },
                data: {
                    profile: mergedProfile,
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
