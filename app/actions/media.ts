'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
        await prisma.media.delete({
            where: { id: mediaId }
        })
        revalidatePath('/workspace/[agentId]/media')
        return { success: true }
    } catch (error: any) {
        throw new Error(error.message)
    }
}
