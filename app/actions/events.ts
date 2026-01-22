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

export type EventData = {
    title: string
    location: string
    startDate: Date
    endDate?: Date
    description?: string
}

export async function getAgentEvents(agentId: number) {
    await checkAuth()
    try {
        return await prisma.agentEvent.findMany({
            where: { agentId },
            orderBy: { startDate: 'desc' }
        })
    } catch (error: any) {
        throw new Error(error.message)
    }
}

export async function createAgentEvent(agentId: number, data: EventData) {
    await checkAuth()
    try {
        const event = await prisma.agentEvent.create({
            data: {
                agentId,
                ...data
            }
        })
        revalidatePath('/workspace/[agentId]/media')
        return { success: true, event }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteAgentEvent(eventId: number) {
    await checkAuth()
    try {
        await prisma.agentEvent.delete({
            where: { id: eventId }
        })
        revalidatePath('/workspace/[agentId]/media')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
