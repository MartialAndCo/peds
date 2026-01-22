'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { openrouter } from '@/lib/openrouter'
import { supabase } from '@/lib/storage'
import { settingsService } from '@/lib/settings-cache'

async function checkAuth() {
    const session = await getServerSession(authOptions)
    if (!session) {
        throw new Error('Unauthorized')
    }
}

export async function saveMedia(url: string, categoryId: string) {
    await checkAuth()

    if (!url || !categoryId) {
        throw new Error('URL and categoryId required')
    }

    try {
        const media = await prisma.media.create({
            data: {
                typeId: categoryId,
                url: url,
                sentTo: []
            }
        })

        revalidatePath('/workspace/[agentId]/media')
        return { success: true, media }
    } catch (error: any) {
        console.error('Save Media Error:', error)
        throw new Error(error.message)
    }
}

export async function updateMediaContext(mediaId: number, context: string) {
    await checkAuth()
    try {
        const media = await prisma.media.update({
            where: { id: mediaId },
            data: { context }
        })
        revalidatePath('/workspace/[agentId]/media')
        return { success: true, media }
    } catch (error: any) {
        console.error('Update Media Context Error:', error)
        throw new Error(error.message)
    }
}

export async function getMediaTypes() {
    await checkAuth()
    try {
        const mediaTypes = await prisma.mediaType.findMany({
            include: {
                medias: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        })
        return mediaTypes
    } catch (error: any) {
        console.error('Get Media Error:', error)
        throw new Error(error.message)
    }
}

export async function createMediaType(data: { id: string, description: string, keywords: string[] }) {
    await checkAuth()
    try {
        const mediaType = await prisma.mediaType.create({
            data
        })
        revalidatePath('/workspace/[agentId]/media')
        return mediaType
    } catch (error: any) {
        if (error.code === 'P2002') throw new Error('Category ID already exists')
        throw new Error(error.message)
    }
}

export async function deleteMediaType(categoryId: string) {
    await checkAuth()
    try {
        await prisma.mediaType.delete({
            where: { id: categoryId }
        })
        revalidatePath('/workspace/[agentId]/media')
        return { success: true }
    } catch (error: any) {
        throw new Error(error.message)
    }
}




export async function deleteMedia(mediaId: number) {
    await checkAuth()
    try {
        // 1. Get media to find the URL
        const media = await prisma.media.findUnique({
            where: { id: mediaId }
        })

        if (!media) throw new Error('Media not found')

        // 2. Delete from Supabase Storage
        if (media.url.includes('/media/')) {
            // Extract path: http://.../media/category/filename.ext -> category/filename.ext
            const path = media.url.split('/media/').pop()
            if (path && supabase) {
                await supabase.storage
                    .from('media')
                    .remove([path])
            }
        }

        // 3. Delete from DB
        await prisma.media.delete({
            where: { id: mediaId }
        })
        revalidatePath('/workspace/[agentId]/media')
        return { success: true }
    } catch (error: any) {
        throw new Error(error.message)
    }
}

export async function generateAutoContext(mediaId: number, agentId: number) {
    await checkAuth()

    try {
        // 1. Fetch Media & Agent Identity
        const media = await prisma.media.findUnique({ where: { id: mediaId } })
        if (!media) throw new Error('Media not found')

        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            include: { agentPrompts: { include: { prompt: true } }, settings: true }
        })

        // 2. Fetch Global Settings (for API Key)
        const globalSettings = await settingsService.getSettings()
        const apiKey = globalSettings.openrouter_api_key as string | undefined

        // Fallback identity if no agent found (shouldn't happen in workspace)
        let identity = "a young woman living in the city"
        let city = "unknown location"

        if (agent) {
            // Extract identity from Prompt or Settings
            const corePrompt = agent.agentPrompts.find(p => p.type === 'CORE')?.prompt.system_prompt
            if (corePrompt) {
                // Try to extract Role/Identity line
                const match = corePrompt.match(/Role: (.*?)(\n|$)/)
                if (match) identity = match[1]
            }

            // Extract City/Bio from settings
            const bio = agent.settings.find(s => s.key === 'bio')?.value
            const location = agent.settings.find(s => s.key === 'location')?.value || agent.settings.find(s => s.key === 'city')?.value

            if (bio) identity += `. Bio: ${bio}`
            if (location) {
                identity += `. I live in ${location}`
                city = location
            }
        }

        console.log(`[AutoContext] Generating for Agent ${agentId} (${city})...`)

        // 3. Fetch Timeline Events (for consistency)
        const events = await prisma.agentEvent.findMany({
            where: { agentId },
            orderBy: { startDate: 'desc' }
        })

        let timelineContext = "No specific known events. You are free to invent consistent locations.";
        if (events.length > 0) {
            timelineContext = "KNOWN TIMELINE (DO NOT CONTRADICT):\n" + events.map((e: any) =>
                `- ${e.title} at ${e.location} (${e.startDate.toLocaleDateString()} - ${e.endDate?.toLocaleDateString() || 'Day Trip'})`
            ).join('\n')
        }

        // 2. Download Image Buffer via Supabase SDK (Bypass Proxy/URL issues)
        let buffer: Buffer;

        // Try to extract path from URL
        // Format: .../media/category/filename.ext or similar
        // If using Supabase Storage, the path is usually after the bucket name or part of the URL.
        // We know we save it as publicUrl.
        // Let's try to extract the relative path: "category/filename"
        // Common pattern: https://.../storage/v1/object/public/media/category/file.jpg

        let storagePath = '';
        if (media.url.includes('/media/')) {
            storagePath = media.url.split('/media/')[1]; // Get everything after /media/
        } else {
            // Fallback: try last 2 segments if structure is simple
            const parts = media.url.split('/');
            if (parts.length >= 2) storagePath = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        }

        console.log(`[AutoContext] Attempting download from storage path: ${storagePath}`)

        if (supabase && storagePath) {
            const { data: blob, error: downloadError } = await supabase.storage
                .from('media')
                .download(storagePath)

            if (downloadError || !blob) {
                console.warn(`[AutoContext] Supabase SDK download failed: ${downloadError?.message}. Falling back to fetch.`)
                // Fallback to fetch
                const response = await fetch(media.url)
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
                const arrayBuffer = await response.arrayBuffer()
                buffer = Buffer.from(arrayBuffer)
            } else {
                const arrayBuffer = await blob.arrayBuffer()
                buffer = Buffer.from(arrayBuffer)
            }
        } else {
            // Fallback if no supabase client or path extraction failed
            console.log('[AutoContext] direct fetch fallback (no supabase client or path)')
            const response = await fetch(media.url)
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
            const arrayBuffer = await response.arrayBuffer()
            buffer = Buffer.from(arrayBuffer)
        }

        if (buffer.length < 100) {
            throw new Error(`Downloaded buffer is too small (${buffer.length} bytes). Path: ${storagePath}`);
        }

        console.log(`[AutoContext] Buffer size: ${buffer.length} bytes`)

        // Derive mimetype
        const ext = media.url.split('.').pop()?.toLowerCase() || 'jpeg';
        let mimeType = 'image/jpeg';
        if (ext === 'png') mimeType = 'image/png';
        if (ext === 'webp') mimeType = 'image/webp';
        if (ext === 'gif') mimeType = 'image/gif';

        // 3. Generate Description with OpenRouter Vision
        const systemInstruction = `You are ${identity}. This is a photo from your personal camera roll (memories).

        TASK: Write the specific STORY/CONTEXT of this photo in the FIRST PERSON.

        MANDATORY REQUIREMENTS:
        1. **WHEN**: You MUST include a specific time reference. NOT "recently". Use: "Summer 2024", "My birthday last year", "Dec '23", "Prom 2022".
        2. **WHERE**: You MUST include a specific location name. NOT "the park". Use: "Central Park", "My trip to Tulum", "The Ritz Paris", "Downtown Chicago".
        
        CRITICAL INSTRUCTIONS:
        - **CHECK TIMELINE**: Review the KNOWN TIMELINE above. If the photo matches a known location (e.g. Paris), you MUST use that date/event.
        - **NO BILOCATION**: If the timeline says I was in "Bali" in Summer 2024, do NOT say "Summer 2024 in New York".
        - **ANALYZE FIRST**: If the image shows a landmark (Eiffel Tower), USE IT. If it shows a specific event (Wedding), use "My cousin's wedding in June".
        - **INVENT IF GENERIC**: If it's just a generic room/street and NOT in the timeline, YOU MUST HALLUCINATE a plausible location consistent with my bio (${city}).
        - **Format**: "[Event/Vibe] at [Location], [Date]. [Emotional/Casual Comment]."
        
        ${timelineContext}
        
        Example: "My outfit for the Gala at The Met, May 2024. Felt absolutely stunning!"
        Example: "Chillin' at Venice Beach, Summer '23. Best vibes ever."
        
        Keep it under 3 sentences. Casual, authentic tone.`

        const description = await openrouter.describeImage(
            buffer,
            mimeType,
            apiKey, // Pass DB API key
            systemInstruction // Pass custom prompt as the "User Message" for Vision
        )

        if (!description) {
            throw new Error('AI Vision returned empty description')
        }

        console.log(`[AutoContext] Generated: "${description}"`)

        // 4. Save to DB
        await prisma.media.update({
            where: { id: mediaId },
            data: { context: description }
        })

        revalidatePath('/workspace/[agentId]/media')

        return { success: true, context: description }

    } catch (error: any) {
        // console.error('Auto-Context Error:', error) 
        // Silent fail mostly, or just log
        console.error('Auto-Context Error:', error)
        return { success: false, error: error.message }
    }
}

// [NEW] Smart Organize Action
export async function smartOrganizeMedia(publicUrl: string, agentId: number) {
    await checkAuth()

    // 1. Fetch Metadata
    const categories = await prisma.mediaType.findMany({ select: { id: true, keywords: true } });
    const events = await prisma.agentEvent.findMany({ where: { agentId }, orderBy: { startDate: 'desc' } });
    const globalSettings = await settingsService.getSettings();
    const apiKey = globalSettings.openrouter_api_key as string | undefined;

    // Timeline Summary
    const timelineSummary = events.map((e: any) => `${e.title} in ${e.location} (${e.startDate.toISOString().split('T')[0]})`).join('\n');
    const categoriesSummary = categories.map((c: any) => c.id).join(', ');

    // 2. Download Image (Need buffer for Vision)
    // For simplicity/speed in prototype, we might try to send URL if OpenRouter supports it? 
    // Usually OpenRouter/LLM vision supports URL. Let's try sending URL first to save bandwidth.
    // Actually, `openrouter.describeImage` expects buffer. We must download.
    // Re-use download logic (simplified)
    const response = await fetch(publicUrl);
    if (!response.ok) throw new Error('Failed to fetch image for analysis');
    const buffer = Buffer.from(await response.arrayBuffer());

    // 3. AI Analysis with Retry Logic
    const prompt = `
    Analyze this image for an influencer's gallery.
    
    KNOWN TIMELINE (Context Only):
    ${timelineSummary}

    EXISTING FOLDERS (PREFER THESE):
    ${categoriesSummary}

    TASK:
    1. Identify content (Selfie, Landscape, Food, etc).
    2. Check Timeline for "When/Where" context (for the caption only).
    3. **CATEGORIZATION RULES**:
       - **ALWAYS PREFER EXISTING FOLDERS**. Do not create new folders for every Trip/Event.
       - Group by THEME, not Location.
       - Example: If "Trip to Milan" and "Trip to Paris", put BOTH in "travel" or "lifestyle_luxury".
       - Example: If "Basketball Game", put in "sports" or "activity".
       - ONLY create a new folder if the content fits NOWHERE in the existing list.
       - New Folder Format: snake_case (e.g. "travel_vlog", "gym_fitness").

    4. Write a Context/Caption (First person, consistent with timeline).

    OUTPUT JSON ONLY:
    {
        "folder": "string (folder_id)",
        "context": "string (caption)"
    }
    `;

    let attempts = 0;
    const MAX_RETRIES = 3;

    while (attempts < MAX_RETRIES) {
        try {
            attempts++;
            const aiResponse = await openrouter.describeImage(
                buffer,
                'image/jpeg',
                apiKey,
                prompt
            );

            // Parse JSON 
            const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI did not return JSON");

            const result = JSON.parse(jsonMatch[0]);
            const folderId = result.folder.toLowerCase().replace(/\s/g, '_');
            const context = result.context;

            // 4. Create Folder if needed
            const existingCat = await prisma.mediaType.findUnique({ where: { id: folderId } });
            if (!existingCat) {
                await prisma.mediaType.create({
                    data: {
                        id: folderId,
                        description: "Auto-created by Smart Upload",
                        keywords: []
                    }
                });
            }

            // 5. Save Media
            const savedMedia = await saveMedia(publicUrl, folderId);

            // 6. Save Context
            if (savedMedia.success && savedMedia.media) {
                await updateMediaContext(savedMedia.media.id, context);
            }

            revalidatePath('/workspace/[agentId]/media');
            return { success: true, folder: folderId, context: context };

        } catch (e: any) {
            console.error(`Smart Organize Attempt ${attempts} Failed:`, e.message);
            if (attempts >= MAX_RETRIES) {
                return { success: false, error: `Failed after ${MAX_RETRIES} attempts: ${e.message}` };
            }
            // Wait a bit before retry? (Optional, maybe 1s)
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    return { success: false, error: "Unexpected loop exit" };
}
