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
        console.log(`[MediaService] Ingesting from ${sourcePhone}, mime: ${mimeType}`)
        // Find most recent pending request
        const latestPending = await prisma.pendingRequest.findFirst({
            where: { status: 'pending' },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`[MediaService] Latest Pending: ${latestPending?.id}, typeId: ${latestPending?.typeId}`)

        if (!latestPending) return null;

        if (!latestPending.typeId) {
            console.error("[MediaService] Pending Request missing typeId, cannot ingest media.");
            return null;
        }
        const typeId = latestPending.typeId;

        // Save to Bank
        const newMedia = await prisma.media.create({
            data: {
                typeId,
                url: mediaData,
                sentTo: []
            }
        });

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
    },

    // 5. Logic: Process Admin Media & Schedule
    async processAdminMedia(sourcePhone: string, ingestionResult: { sentTo: string, type: string, mediaUrl: string, mediaType: string }) {
        const { TimingManager } = require('@/lib/timing');

        const contactPhone = ingestionResult.sentTo;
        const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: contactPhone } });

        if (!contact) {
            console.error('[MediaService] Contact not found for scheduling:', contactPhone);
            return null;
        }

        // Smart Schedule Logic
        let conversation = await prisma.conversation.findFirst({ where: { contactId: contact.id, status: 'active' }, include: { prompt: true } });
        if (!conversation) {
            // Default prompt if not exists (fallback)
            const prompt = await prisma.prompt.findFirst() || await prisma.prompt.create({ data: { id: 1, name: 'Default', system_prompt: 'Friend', model: 'llama' } });
            conversation = await prisma.conversation.create({ data: { contactId: contact.id, promptId: prompt.id, status: 'active' }, include: { prompt: true } });
        }

        const lastMessages = await prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { timestamp: 'desc' }, take: 15 });
        const history = lastMessages.reverse().map((m: any) => `${m.sender === 'user' ? 'User' : 'You'}: ${m.message_text}`).join('\n');
        const nowLA = TimingManager.getLATime().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });

        const schedulingPrompt = `(SYSTEM: You just received the photo the user asked for (Type: ${ingestionResult.type}). Goal: Deliver naturally.\nContext: Time ${nowLA}\nChat History:\n${history}\nTask: 1. Did you promise a time? 2. Calculate delay (min 1m). 3. Write caption.\nOutput JSON: { "reasoning": "...", "delay_minutes": 5, "caption": "..." })`;

        const settings = await getSettings();
        const provider = settings.ai_provider || 'venice';

        let aiResponseText = "{}";
        try {
            if (provider === 'anthropic') {
                aiResponseText = await anthropic.chatCompletion(conversation.prompt.system_prompt, [], schedulingPrompt, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model });
            } else {
                aiResponseText = await venice.chatCompletion(conversation.prompt.system_prompt, [], schedulingPrompt, { apiKey: settings.venice_api_key, model: settings.venice_model });
            }
        } catch (e) { console.error("[MediaService] AI Sched Failed", e); }

        let sched = { delay_minutes: 5, caption: "Here!", reasoning: "Default" };
        try {
            const match = aiResponseText.match(new RegExp('\\{[\\s\\S]*\\}'));
            if (match) sched = JSON.parse(match[0]);
        } catch (e) { }

        const delay = Math.max(1, sched.delay_minutes || 2);
        const scheduledAt = new Date(Date.now() + delay * 60 * 1000); // Wait delay minutes

        console.log(`[MediaService] Queueing item for ${contact.id} at ${scheduledAt}`);

        const newItem = await prisma.messageQueue.create({
            data: {
                contactId: contact.id,
                conversationId: conversation.id,
                content: sched.caption || "Sent.",
                mediaUrl: ingestionResult.mediaUrl,
                mediaType: ingestionResult.mediaType,
                scheduledAt: scheduledAt,
                status: 'PENDING'
            }
        });

        // Try Notify Source (Optional, swallow errors)
        try {
            await whatsapp.sendText(sourcePhone, `📅 Scheduled: ${scheduledAt.toLocaleTimeString()} (${delay}m).\nReason: ${sched.reasoning}`);
        } catch (e) { console.warn("[MediaService] Failed to notify source (WAHA error?), but Queue Item created."); }

        return newItem;
    }
};
