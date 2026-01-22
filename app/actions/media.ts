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
        
        CRITICAL INSTRUCTIONS:
        1. **IDENTIFY THE EVENT**: If I'm in a gown/dress, it is likely "My Prom", "A Wedding", or "A Gala". It is NOT just "the park". If I'm on a beach, it's "My trip to Tulum/Bali/Nice".
        2. **HALLUCINATE DETAILS**: You MUST invent a plausible Date (e.g. "Prom 2023", "Last summer"), a specific fake Location, or a specific vibe. match my persona location if possible.
        3. **NO LITERAL DESCRIPTIONS**: Do NOT say "I am standing on stairs wearing a blue dress". Say "I felt like a queen at Prom '23, even if these heels killed my feet!".
        4. **TONE**: Casual, authentic, slightly emotional or vain.
        
        Keep it under 3 sentences. Make it sound like a real memory.`

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
