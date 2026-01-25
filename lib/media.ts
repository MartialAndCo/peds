import { prisma } from '@/lib/prisma';
import { whatsapp } from '@/lib/whatsapp';
import { venice } from '@/lib/venice';
import { anthropic } from '@/lib/anthropic';
import { logger } from '@/lib/logger';

import { settingsService } from '@/lib/settings-cache';

// Simple Cache System
const cache = {
    blacklist: { data: null as any, expiry: 0 },
    mediaTypes: { data: null as any, expiry: 0 }
};
const CACHE_TTL = 60000; // 60 seconds

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
    // 1. Analyze Request (Smart Logic) - Now phase-aware
    async analyzeRequest(text: string, contactPhone?: string, agentId?: string) {
        console.log(`[MediaService] Analyzing request: "${text}" (Contact: ${contactPhone || 'unknown'}, Agent: ${agentId})`)
        logger.info(`Analyzing request: "${text}"`, { module: 'media_service', contactPhone, agentId });

        // Fetch contact's current phase (default to CONNECTION if unknown)
        let contactPhase = 'CONNECTION';
        if (contactPhone && agentId) {
            const agentContact = await prisma.agentContact.findUnique({
                where: { agentId_contactId: { agentId, contactId: (await prisma.contact.findUnique({ where: { phone_whatsapp: contactPhone } }))?.id || '' } }
            });
            if (agentContact?.phase) {
                contactPhase = agentContact.phase;
            }
        }
        console.log(`[MediaService] Contact phase: ${contactPhase}`)

        // Fetch Cached Data (Parallelize for Cold Start Optimization)
        const [allBlacklistRules, settings, mediaTypes] = await Promise.all([
            getCachedBlacklist(),
            settingsService.getSettings(),
            getCachedMediaTypes()
        ]);

        // Filter blacklist rules by phase: include rules for current phase OR 'all'
        const blacklist = allBlacklistRules.filter((b: any) =>
            b.phase === 'all' || b.phase === contactPhase
        );
        console.log(`[MediaService] Filtered blacklist: ${blacklist.length} rules (from ${allBlacklistRules.length} total)`)

        const availableCategories = mediaTypes.map((t: any) => `${t.id} (${t.description})`).join(', ');
        const blacklistText = blacklist.map((b: any) => `- ${b.term} (Forbidden in ${b.mediaType})`).join('\n');

        const defaultAnalysisPrompt = `You are a Content Safety and Intent Analyzer for a personal media banking system.
        
        Your Goal:
        1. Check if the user's request violates any BLACKLIST rules.
        2. If allowed, identify the intent category from the available list.
        
        CURRENT PHASE: ${contactPhase}
        
        Blacklist Rules (STRICTLY FORBIDDEN for this phase):
        ${blacklistText || '(No restrictions for this phase)'}

        Available Categories:
        ${availableCategories}

        Instructions:
        - If the request violates the blacklist, set "allowed" to false and explain why briefly.
        - If the request is NOT in the blacklist, set "allowed" to true.
        - IMPORTANT: Only refuse what's EXPLICITLY in the blacklist. Accept everything else.
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
            .replace('{BLACKLIST}', blacklistText || '(No restrictions for this phase)')
            .replace('{CATEGORIES}', availableCategories)
            .replace('{PHASE}', contactPhase);

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

    // Helper: Find Media Type by Keyword (Deterministic)
    async findMediaTypeByKeyword(keyword: string) {
        const types = await getCachedMediaTypes();
        const normalized = keyword.toLowerCase().trim();

        // 1. Precise Match (ID)
        const exactId = types.find((t: any) => t.id.toLowerCase() === normalized);
        if (exactId) return exactId.id;

        // 2. Keyword Match
        const keywordMatch = types.find((t: any) => t.keywords.some((k: string) => k.toLowerCase() === normalized));
        if (keywordMatch) return keywordMatch.id;

        return null;
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
    async requestFromSource(contactPhone: string, typeId: string, agentSettings?: any, agentId?: string) {
        // Use Agent settings if passed, otherwise query global
        let sourcePhone: string | undefined;
        let adminPhone: string | undefined;

        if (agentSettings) {
            sourcePhone = agentSettings.media_source_number;
            adminPhone = agentSettings.source_phone_number;
        } else {
            // Fallback to global settings (legacy)
            const settings = await prisma.setting.findUnique({ where: { key: 'media_source_number' } });
            sourcePhone = settings?.value;
            const adminSettings = await prisma.setting.findUnique({ where: { key: 'source_phone_number' } });
            adminPhone = adminSettings?.value;
        }

        // Fallback to Admin Phone if Media Source not set
        const targetPhone = sourcePhone || adminPhone

        if (!targetPhone) return 'NO_SOURCE';
        console.log(`[MediaService] Requesting from source. Target: ${targetPhone}, AgentId: ${agentId}`)

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

        const settingsAll: any = await settingsService.getSettings();
        const msgTemplate = settingsAll.msg_media_request_source || defaultMsg;
        const msg = msgTemplate
            .replace('{PHONE}', contactPhone)
            .replace('{TYPE}', typeId);
        await whatsapp.sendText(targetPhone, msg, undefined, agentId);

        return 'REQUEST_NEW';
    },

    // 4. Ingest Media
    async ingestMedia(sourcePhone: string, mediaData: string, mimeType: string) {
        logger.info(`Ingesting media`, { module: 'media_service', sourcePhone, mimeType });

        // Defensive check for mimeType
        const safeMimeType = typeof mimeType === 'string' ? mimeType : 'unknown'

        // Find most recent pending request
        const latestPending = await prisma.pendingRequest.findFirst({
            where: { status: 'pending' },
            orderBy: { createdAt: 'desc' }
        });
        logger.info(`Latest Pending Request`, { module: 'media_service', requestId: latestPending?.id, typeId: latestPending?.typeId });

        if (!latestPending) return null;

        // --- RVC INTERCEPTION ---
        const isAudio = safeMimeType.startsWith('audio') || latestPending.typeId === 'audio' || latestPending.typeId === 'voice_note';

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

        // UPLOAD TO SUPABASE (Always, to avoid Base64 DB limits)
        let finalMediaUrl = mediaData;
        try {
            const { createClient } = require('@supabase/supabase-js');
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            if (url && key) {
                const supabase = createClient(url, key);
                // Extract buffer from base64
                const base64Content = mediaData.includes('base64,') ? mediaData.split('base64,')[1] : mediaData;
                const buffer = Buffer.from(base64Content, 'base64');
                const ext = (mimeType || 'image/jpeg').split('/')[1] || 'bin';
                const fileName = `ingest_${latestPending.id}_${Date.now()}.${ext}`;

                const { error: upErr } = await supabase.storage.from('media-uploads').upload(fileName, buffer, {
                    contentType: mimeType || 'image/jpeg',
                    upsert: true
                });

                if (!upErr) {
                    const { data } = supabase.storage.from('media-uploads').getPublicUrl(fileName);
                    if (data?.publicUrl) {
                        finalMediaUrl = data.publicUrl;
                        logger.info(`Media uploaded to Supabase: ${finalMediaUrl}`, { module: 'media_service' });
                    }
                } else {
                    // Fallback to existing bucket if media-uploads doesn't exist? try voice-uploads?
                    // Actually, let's try 'voice-uploads' as fallback or just log error?
                    // Let's stick to 'voice-uploads' if that's what we have, or assumes 'media-uploads' exists.
                    // User previous code used 'voice-uploads'. Let's use 'voice-uploads' for now to be safe, or just 'media'.
                    // Actually, let's use 'voice-uploads' strictly to avoid 404 on bucket? 
                    // No, 'voice-uploads' might be confusing. Let's try 'chat-media' or if we can't create, fallback to base64.

                    // REVISION: Use 'voice-uploads' bucket as it's confirmed to exist and work in this project.
                    // Rename file prefix to distinguish.
                    console.error('Supabase Upload failed to media-uploads, trying voice-uploads fallback...', upErr);
                    const { error: retryErr } = await supabase.storage.from('voice-uploads').upload(fileName, buffer, {
                        contentType: mimeType || 'image/jpeg',
                        upsert: true
                    });
                    if (!retryErr) {
                        const { data } = supabase.storage.from('voice-uploads').getPublicUrl(fileName);
                        finalMediaUrl = data.publicUrl;
                    }
                }
            }
        } catch (uploadError) {
            logger.error('Failed to upload media, falling back to Base64', uploadError as Error, { module: 'media_service' });
            if (!mediaData.startsWith('data:')) {
                mediaData = `data:${mimeType || 'image/jpeg'};base64,${mediaData}`;
                finalMediaUrl = mediaData;
            }
        }

        // Save to Bank
        const newMedia = await prisma.media.create({
            data: {
                typeId,
                url: finalMediaUrl,
                sentTo: []
            }
        });

        // Fulfill Request
        const contactPhone = latestPending.requesterPhone;

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

        return { sentTo: contactPhone, type: typeId, mediaUrl: finalMediaUrl, mediaType: mimeType };
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

        const settings: any = await settingsService.getSettings();

        // Updated Prompt: Enforce variety and natural behavior
        const isVoice = ingestionResult.mediaType.startsWith('audio') || ingestionResult.type === 'voice_note' || ingestionResult.type === 'ptt';

        let sched: any = { delay_minutes: 2, caption: "", reasoning: "Voice Default", strategy: "DIRECT", pre_text: null };

        if (isVoice) {
            // BYPASS AI for Voice: Just send it.
            sched = {
                delay_minutes: 0, // Instant
                caption: "",      // No text
                strategy: "DIRECT",
                reasoning: "Voice Note - Immediate Send (Bypass)"
            };
        } else {
            const mediaLabel = "photo"; // Audio handled above
            const actionLabel = "Send photo";

            const defaultSchedulingPrompt = `(SYSTEM: You received the ${mediaLabel} the user asked for (${ingestionResult.type}). Goal: Send it now, but BE NATURAL.
Task: Choose a Strategy and write the text.

Strategies (Pick one randomly):
1. "DIRECT": ${actionLabel} with short caption (e.g. "Here you go!").
2. "SILENT": ${actionLabel} with NO text at all.
3. "TEASE": Send a text first (e.g. "Ok wait... found it"), delay 30s, then ${actionLabel}.
4. "QUESTION": ${actionLabel}, then ask a simple question (e.g. "Do you like it?").

Output JSON:
{ 
  "reasoning": "Strategy reasoning...",
  "strategy": "DIRECT" | "SILENT" | "TEASE" | "QUESTION",
  "delay_minutes": 2, 
  "pre_text": "Optional text to send BEFORE ${mediaLabel} (for TEASE)",
  "caption": "Text to send WITH ${mediaLabel} (keep it short < 10 words)" 
})`;

            const schedulingPromptTemplate = settings.prompt_media_scheduling || defaultSchedulingPrompt;
            const schedulingPrompt = schedulingPromptTemplate
                .replace('{TYPE}', ingestionResult.type)
                .replace('{TIME}', nowLA)
                .replace('{HISTORY}', history);
            const provider = settings.ai_provider || 'venice';

            // Use Director to build FULL prompt so scheduling (tease/shy) matches Phase
            const { director } = require('@/lib/director')
            const { phase, details } = await director.determinePhase(contact.phone_whatsapp, conversation.agentId)
            const fullSystemPrompt = await director.buildSystemPrompt(
                settings,
                contact,
                phase,
                details,
                conversation.prompt.system_prompt,
                conversation.agentId
            )

            let aiResponseText = "{}";
            try {
                if (provider === 'anthropic') {
                    aiResponseText = await anthropic.chatCompletion(fullSystemPrompt, [], schedulingPrompt, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model });
                } else {
                    aiResponseText = await venice.chatCompletion(fullSystemPrompt, [], schedulingPrompt, { apiKey: settings.venice_api_key, model: settings.venice_model });
                }
            } catch (e: any) { logger.error("AI Sched Failed", e, { module: 'media_service' }); }

            try {
                const match = aiResponseText.match(new RegExp('\\{[\\s\\S]*\\}'));
                if (match) sched = JSON.parse(match[0]);
            } catch (e) { }
        }

        // --- EXECUTE STRATEGY ---

        // 1. Pre-Text (Immediate or Short Delay)
        if (sched.pre_text && (sched.strategy === 'TEASE' || sched.pre_text.length > 0)) {
            logger.info(`Queueing PRE-TEXT item`, { module: 'media_service', contactId: contact.id });
            await prisma.messageQueue.create({
                data: {
                    contactId: contact.id,
                    conversationId: conversation.id,
                    content: sched.pre_text,
                    scheduledAt: new Date(Date.now() + 5000), // 5s delay
                    status: 'PENDING'
                }
            });
        }

        // 2. Media Item
        const delay = Math.max(1, sched.delay_minutes || 2);
        const scheduledAt = new Date(Date.now() + delay * 60 * 1000);

        // Fix Caption based on Strategy
        let finalCaption = sched.caption || "";
        if (sched.strategy === 'SILENT') finalCaption = "";

        logger.info(`Queueing MEDIA item`, { module: 'media_service', contactId: contact.id, scheduledAt, strategy: sched.strategy });

        const newItem = await prisma.messageQueue.create({
            data: {
                contactId: contact.id,
                conversationId: conversation.id,
                content: finalCaption,
                mediaUrl: ingestionResult.mediaUrl,
                mediaType: ingestionResult.mediaType,
                duration: ingestionResult.duration,
                scheduledAt: scheduledAt,
                status: 'PENDING'
            }
        });

        // Try Notify Source
        try {
            const strategyInfo = sched.strategy === 'TEASE' ? `TEASE (Pre: "${sched.pre_text}")` : sched.strategy;
            // await whatsapp.sendText(sourcePhone, `📅 Scheduled: ${scheduledAt.toLocaleTimeString()} (${delay}m).\nStrats: ${strategyInfo}`);
        } catch (e) { logger.warn("Failed to notify source", { module: 'media_service' }); }

        return newItem;
    }
};
