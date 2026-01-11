import { prisma } from '@/lib/prisma';
import { whatsapp } from '@/lib/whatsapp';
import { venice } from '@/lib/venice';
import { anthropic } from '@/lib/anthropic';
import { logger } from '@/lib/logger';

// Simple Cache System
const cache = {
    settings: { data: null as any, expiry: 0 },
    blacklist: { data: null as any, expiry: 0 },
    mediaTypes: { data: null as any, expiry: 0 }
};
const CACHE_TTL = 60000; // 60 seconds

// Helper to fetch settings (Cached)
async function getSettings() {
    if (Date.now() < cache.settings.expiry && cache.settings.data) return cache.settings.data;
    try {
        const settingsList = await prisma.setting.findMany();
        const data = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        cache.settings = { data, expiry: Date.now() + CACHE_TTL };
        return data;
    } catch (e: any) {
        logger.error('Failed to fetch settings, using cache or empty', e, { module: 'media_cache' });
        return cache.settings.data || {};
    }
}

async function getCachedBlacklist() {
    if (Date.now() < cache.blacklist.expiry && cache.blacklist.data) return cache.blacklist.data;
    try {
        const data = await prisma.blacklistRule.findMany();
        cache.blacklist = { data, expiry: Date.now() + CACHE_TTL };
        return data;
    } catch (e) { return cache.blacklist.data || []; }
}

async function getCachedMediaTypes() {
    if (Date.now() < cache.mediaTypes.expiry && cache.mediaTypes.data) return cache.mediaTypes.data;
    try {
        const data = await prisma.mediaType.findMany();
        cache.mediaTypes = { data, expiry: Date.now() + CACHE_TTL };
        return data;
    } catch (e) { return cache.mediaTypes.data || []; }
}

export const mediaService = {
    // 1. Analyze Request (Smart Logic)
    async analyzeRequest(text: string) {
        logger.info(`Analyzing request: "${text}"`, { module: 'media_service' });

        // Fetch Cached Data
        const blacklist = await getCachedBlacklist();
        const settings = await getSettings();
        const mediaTypes = await getCachedMediaTypes();
        const availableCategories = mediaTypes.map((t: any) => `${t.id} (${t.description})`).join(', ');

        const blacklistText = blacklist.map((b: any) => `- ${b.term} (Forbidden in ${b.mediaType})`).join('\n');

        const defaultAnalysisPrompt = `You are a Content Safety and Intent Analyzer for a personal media banking system.
        
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

        const systemPromptTemplate = settings.prompt_media_analysis || defaultAnalysisPrompt;
        const systemPrompt = systemPromptTemplate
            .replace('{BLACKLIST}', blacklistText)
            .replace('{CATEGORIES}', availableCategories);

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
            logger.warn('Failed to parse AI JSON response', { module: 'media_service', responseText });
            return null;

        } catch (e: any) {
            logger.error('Analysis Failed', e, { module: 'media_service' });
            return null;
        }
    },

    // 2. Process Request
    async processRequest(contactPhone: string, typeId: string) {
        logger.info(`Processing request for ${typeId}`, { module: 'media_service', contactPhone });

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
        // Use separate Media Source Number
        const settings = await prisma.setting.findUnique({ where: { key: 'media_source_number' } });
        const sourcePhone = settings?.value;
        const adminSettings = await prisma.setting.findUnique({ where: { key: 'source_phone_number' } })
        const adminPhone = adminSettings?.value

        // Fallback to Admin Phone if Media Source not set
        const targetPhone = sourcePhone || adminPhone

        if (!targetPhone) return 'NO_SOURCE';

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

        const defaultMsg = `📸 *Media Request*\n\nUser ${contactPhone} wants: *${typeId}*\n\nReply with a photo/video (or just chat) to fulfill it.`;
        const settingsAll = await getSettings();
        const msgTemplate = settingsAll.msg_media_request_source || defaultMsg;
        const msg = msgTemplate
            .replace('{PHONE}', contactPhone)
            .replace('{TYPE}', typeId);
        await whatsapp.sendText(targetPhone, msg);

        return 'REQUEST_NEW';
    },

    // 4. Ingest Media
    async ingestMedia(sourcePhone: string, mediaData: string, mimeType: string) {
        logger.info(`Ingesting media`, { module: 'media_service', sourcePhone, mimeType });

        // Find most recent pending request
        const latestPending = await prisma.pendingRequest.findFirst({
            where: { status: 'pending' },
            orderBy: { createdAt: 'desc' }
        });
        logger.info(`Latest Pending Request`, { module: 'media_service', requestId: latestPending?.id, typeId: latestPending?.typeId });

        if (!latestPending) return null;

        // --- RVC INTERCEPTION ---
        const isAudio = mimeType.startsWith('audio') || latestPending.typeId === 'audio' || latestPending.typeId === 'voice_note';

        if (isAudio && latestPending) {
            logger.info('Audio detected. Intercepting for RVC Processing...', { module: 'media_service' });

            try {
                const { rvcService } = require('@/lib/rvc');

                // 1. Get Target Voice ID
                // Try to find via Contact -> Conversation -> Agent
                const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: latestPending.requesterPhone } });
                let voiceId = null;

                if (contact) {
                    const conv = await prisma.conversation.findFirst({ where: { contactId: contact.id }, orderBy: { createdAt: 'desc' } });
                    if (conv && conv.agentId) {
                        const settings = await prisma.agentSetting.findFirst({ where: { agentId: conv.agentId, key: 'voice_id' } });
                        if (settings) voiceId = settings.value;
                    }
                }

                // Fallback to Global Defaults or Agent 1
                if (!voiceId) {
                    const s = await prisma.setting.findUnique({ where: { key: 'voice_id' } }); // Global fallback
                    voiceId = s?.value || process.env.RVC_DEFAULT_VOICE_ID;
                }

                if (!voiceId) {
                    logger.warn('No Voice ID found. Uploading raw audio or failing?', { module: 'media_service' });
                    // If no voice ID, maybe just send raw audio? For now, fail safe.
                    // voiceId = 'default'; 
                }

                logger.info(`Using Voice ID: ${voiceId}`, { module: 'media_service' });

                // 2. Prepare Source Audio (Supabase logic for large files)
                let finalAudioInput = mediaData;
                let sourceUrl = null;

                // Clean base64 header if present for length check
                const base64Content = mediaData.includes('base64,') ? mediaData.split('base64,')[1] : mediaData;
                const buffer = Buffer.from(base64Content, 'base64');

                // Reuse 8MB Limit logic
                if (buffer.length > 8 * 1024 * 1024) {
                    logger.info('Source Audio > 8MB. Uploading to Supabase...', { module: 'media_service' });
                    const { createClient } = require('@supabase/supabase-js');
                    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
                    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                    if (url && key) {
                        const supabase = createClient(url, key);
                        const fileName = `source_${latestPending.id}_${Date.now()}.mp3`;
                        const { error: upErr } = await supabase.storage.from('voice-uploads').upload(fileName, buffer, { contentType: mimeType || 'audio/mpeg' });

                        if (!upErr) {
                            const { data } = supabase.storage.from('voice-uploads').getPublicUrl(fileName);
                            if (data?.publicUrl) {
                                finalAudioInput = data.publicUrl; // URL Input for RunPod
                                sourceUrl = data.publicUrl;
                            }
                        } else {
                            logger.error('Supabase Upload failed', upErr, { module: 'media_service' });
                        }
                    }
                }

                // 3. Start RVC Job
                const jobId = await rvcService.startJob(finalAudioInput, { voiceId: voiceId ? Number(voiceId) : undefined }); // AI Context check handled by Cron

                // 4. Update Pending Request
                await prisma.pendingRequest.update({
                    where: { id: latestPending.id },
                    data: {
                        status: 'processing',
                        jobId: jobId,
                        voiceId: voiceId,
                        sourceAudioUrl: sourceUrl
                    }
                });

                logger.info(`RVC Job Started: ${jobId}`, { module: 'media_service' });
                return null; // STOP HERE. Don't fulfill yet.

            } catch (err: any) {
                logger.error('RVC Interception Failed', err, { module: 'media_service' });
                // Fallback to normal ingestion (send raw)?
            }
        }
        // --- END INTERCEPTION ---

        if (!latestPending.typeId) {
            logger.error("Pending Request missing typeId, cannot ingest media.", undefined, { module: 'media_service' });
            return null;
        }
        const typeId = latestPending.typeId;

        if (!mediaData.startsWith('data:')) {
            mediaData = `data:${mimeType || 'image/jpeg'};base64,${mediaData}`;
        }

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
    async processAdminMedia(sourcePhone: string, ingestionResult: { sentTo: string, type: string, mediaUrl: string, mediaType: string, duration?: number | null }) {
        const { TimingManager } = require('@/lib/timing');

        const contactPhone = ingestionResult.sentTo;
        const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: contactPhone } });

        if (!contact) {
            logger.error('Contact not found for scheduling', undefined, { module: 'media_service', contactPhone });
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

        const settings = await getSettings();

        const defaultSchedulingPrompt = `(SYSTEM: You just received the photo the user asked for (Type: ${ingestionResult.type}). Goal: Deliver naturally.\nContext: Time ${nowLA}\nChat History:\n${history}\nTask: 1. Did you promise a time? 2. Calculate delay (min 1m). 3. Write caption.\nOutput JSON: { "reasoning": "...", "delay_minutes": 5, "caption": "..." })`;
        const schedulingPromptTemplate = settings.prompt_media_scheduling || defaultSchedulingPrompt;
        const schedulingPrompt = schedulingPromptTemplate
            .replace('{TYPE}', ingestionResult.type)
            .replace('{TIME}', nowLA)
            .replace('{HISTORY}', history);
        const provider = settings.ai_provider || 'venice';

        let aiResponseText = "{}";
        try {
            if (provider === 'anthropic') {
                aiResponseText = await anthropic.chatCompletion(conversation.prompt.system_prompt, [], schedulingPrompt, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model });
            } else {
                aiResponseText = await venice.chatCompletion(conversation.prompt.system_prompt, [], schedulingPrompt, { apiKey: settings.venice_api_key, model: settings.venice_model });
            }
        } catch (e: any) { logger.error("AI Sched Failed", e, { module: 'media_service' }); }

        let sched = { delay_minutes: 5, caption: "Here!", reasoning: "Default" };
        try {
            const match = aiResponseText.match(new RegExp('\\{[\\s\\S]*\\}'));
            if (match) sched = JSON.parse(match[0]);
        } catch (e) { }

        const delay = Math.max(1, sched.delay_minutes || 2);
        const scheduledAt = new Date(Date.now() + delay * 60 * 1000); // Wait delay minutes

        logger.info(`Queueing item`, { module: 'media_service', contactId: contact.id, scheduledAt });

        const newItem = await prisma.messageQueue.create({
            data: {
                contactId: contact.id,
                conversationId: conversation.id,
                content: sched.caption || "Sent.",
                mediaUrl: ingestionResult.mediaUrl,
                mediaType: ingestionResult.mediaType,
                duration: ingestionResult.duration,
                scheduledAt: scheduledAt,
                status: 'PENDING'
            }
        });

        // Try Notify Source (Optional, swallow errors)
        try {
            await whatsapp.sendText(sourcePhone, `📅 Scheduled: ${scheduledAt.toLocaleTimeString()} (${delay}m).\nReason: ${sched.reasoning}`);
        } catch (e) { logger.warn("Failed to notify source (WAHA error?), but Queue Item created.", { module: 'media_service' }); }

        return newItem;
    }
};
