import { prisma } from '@/lib/prisma';
import { whatsapp } from '@/lib/whatsapp';
import { venice } from '@/lib/venice';
import { anthropic } from '@/lib/anthropic';

// Helper to fetch settings
async function getSettings() {
    const settingsList = await prisma.setting.findMany();
    return settingsList.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {});
}

export const mediaService = {
    // 1. Analyze Request (Smart Logic)
    async analyzeRequest(text: string) {
        console.log(`[Media] Analyzing request: "${text}"`);

        // Fetch Blacklist Rules
        const blacklist = await prisma.blacklistRule.findMany();
        const settings = await getSettings();

        // Fetch Media Types for context
        const mediaTypes = await prisma.mediaType.findMany();
        const availableCategories = mediaTypes.map(t => `${t.id} (${t.description})`).join(', ');

        const blacklistText = blacklist.map(b => `- ${b.term} (Forbidden in ${b.mediaType})`).join('\n');

        const systemPrompt = `You are a Content Safety and Intent Analyzer for a personal media banking system.
        
        Your Goal:
        1. Check if the user's request violates any BLACKLIST rules.
        2. If allowed, identify the intent category from the available list.
        
        Blacklist Rules (STRICTLY FORBIDDEN):
        ${blacklistText}

        Available Categories:
        ${availableCategories}

        Instructions:
        - If the request violates the blacklist, set "allowed" to false and explain why briefly.
        - If the request is safe, set "allowed" to true.
        - If "allowed" is true, try to match the user's intent to one of the Available Categories. Look for semantic meaning (e.g. "ankles" -> "photo_pieds"). 
        - If no category matches, set "intentCategory" to null.
        - If the user is NOT asking for media (just chatting), set "isMediaRequest" to false.

        Output JSON format ONLY:
        {
            "isMediaRequest": boolean,
            "allowed": boolean,
            "refusalReason": string | null,
            "intentCategory": string | null // must match an id from Available Categories
        }`;

        try {
            // Use Venice or Anthropic based on settings preference
            const apiKey = settings.venice_api_key;
            // Force JSON mode if possible or just parse text
            // For now, prompt engineering for JSON.

            const userMessage = `Analyze this request: "${text}"`;

            let responseText = "";
            if (settings.ai_provider === 'anthropic') {
                // simplify for now or use the preferred provider
                responseText = await anthropic.chatCompletion(
                    systemPrompt, [], userMessage,
                    { apiKey: settings.anthropic_api_key, model: settings.anthropic_model || 'claude-3-haiku-20240307' }
                );
            } else {
                responseText = await venice.chatCompletion(
                    systemPrompt, [], userMessage,
                    { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored' }
                );
            }

            // Extract JSON from response (sometimes models add markdown)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            console.warn('[Media] Failed to parse AI JSON response:', responseText);
            return null;

        } catch (e: any) {
            console.error('[Media] Analysis Failed:', e.message);
            return null;
        }
    },

    // 2. Process Request
    async processRequest(contactPhone: string, typeId: string) {
        console.log(`[Media] Processing request for ${typeId} from ${contactPhone}`);

        // A. Check Bank
        const allMedias = await prisma.media.findMany({ where: { typeId } });
        const availableMedias = allMedias.filter(m => !m.sentTo.includes(contactPhone));

        if (availableMedias.length > 0) {
            // Send one
            const mediaToSend = availableMedias[0];
            return { action: 'SEND', media: mediaToSend };
        }

        // B. Request Source
        return { action: 'REQUEST_SOURCE' };
    },

    // 3. Request from Source
    async requestFromSource(contactPhone: string, typeId: string) {
        const settings = await prisma.setting.findUnique({ where: { key: 'source_phone_number' } });
        const sourcePhone = settings?.value;

        if (!sourcePhone) return 'NO_SOURCE';

        const existing = await prisma.pendingRequest.findFirst({
            where: { typeId, requesterPhone: contactPhone, status: 'pending' }
        });

        if (existing) {
            return 'REQUEST_PENDING';
        }

        // Fetch type details to populate required fields
        const mediaType = await prisma.mediaType.findUnique({ where: { id: typeId } });

        await prisma.pendingRequest.create({
            data: {
                typeId,
                requesterPhone: contactPhone,
                status: 'pending',
                mediaType: 'image', // Default assumption, or could be inferred from typeId keywords? "photo_" -> image
                description: mediaType?.description || `Request for ${typeId}`
            }
        });

        const msg = `📸 *Media Request*\n\nUser ${contactPhone} wants: *${typeId}*\n\nReply with a photo/video (or just chat) to fulfill it.`;
        await whatsapp.sendText(sourcePhone, msg);

        return 'REQUEST_NEW';
    },

    // 4. Ingest Media
    async ingestMedia(sourcePhone: string, mediaData: string, mimeType: string) {
        // Find most recent pending request
        const latestPending = await prisma.pendingRequest.findFirst({
            where: { status: 'pending' },
            orderBy: { createdAt: 'desc' }
        });

        if (!latestPending) return null;

        const typeId = latestPending.typeId;

        // Save to Bank (Only if categorized)
        if (typeId) {
            await prisma.media.create({
                data: {
                    typeId,
                    url: mediaData,
                    sentTo: []
                }
            });
        }

        // Fulfill Request
        const contactPhone = latestPending.requesterPhone;

        // (Removed immediate send logic)

        // Mark sent
        await prisma.media.update({
            where: { id: newMedia.id },
            data: { sentTo: { push: contactPhone } }
        });

        // Close Pending
        await prisma.pendingRequest.update({
            where: { id: latestPending.id },
            data: { status: 'fulfilled' }
        });

        return { sentTo: contactPhone, type: typeId, mediaUrl: mediaData, mediaType: mimeType };
    }
};
