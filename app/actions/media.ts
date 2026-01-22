'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { openrouter } from '@/lib/openrouter'

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

import { supabase } from '@/lib/storage'

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

        // 2. Download Image Buffer
        // If URL is Supabase: fetch it.
        const response = await fetch(media.url)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)


        // 3. Generate Description with OpenRouter Vision
        // "You are [Identity]. This is a photo from your gallery. Describe it briefly in the first person..."
        const systemInstruction = `You are ${identity}. This is a photo from your personal gallery that you might send to a friend. 
        Task: Describe this image briefly in the FIRST PERSON (e.g. "My bedroom...", "Me at the park..."). 
        Crucial: Mention specific details that match your identity/location if visible. Keep it under 2 sentences. Natural, casual tone.`

        const description = await openrouter.describeImage(
            buffer,
            'image/jpeg', // Assumption, but describeImage handles buffers generally
            undefined, // Use env key
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
        console.error('Auto-Context Error:', error)
        return { success: false, error: error.message }
    }
}
