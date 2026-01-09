
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

import { rvcService } from '@/lib/rvc'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const generationId = parseInt(id)

    try {
        const generation = await prisma.voiceGeneration.findUnique({
            where: { id: generationId },
            select: {
                id: true,
                status: true,
                createdAt: true,
                jobId: true,
                error: true,
                voiceModelId: true,
                voiceModel: { select: { name: true } }
                // audioUrl: false // Exclude!
            }
        })

        if (!generation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        // If completed or failed (terminal state), return immediately
        if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
            return NextResponse.json(generation)
        }

        // If pending and has jobId, check status
        if (generation.jobId) {
            const check = await rvcService.checkJob(generation.jobId)

            if (check.status === 'COMPLETED' && check.output?.audio_base64) {
                const audioUrl = `data:audio/mpeg;base64,${check.output.audio_base64}`

                await prisma.voiceGeneration.update({
                    where: { id: generationId },
                    data: {
                        status: 'COMPLETED',
                        audioUrl
                    }
                })

                // Return WITHOUT the massive audioUrl
                return NextResponse.json({ ...generation, status: 'COMPLETED', audioUrl: null })
            }
            else if (check.status === 'FAILED' || check.status === 'TIMED_OUT' || check.status === 'error') {
                await prisma.voiceGeneration.update({
                    where: { id: generationId },
                    data: { status: 'FAILED', error: check.error || 'RunPod Job Failed' }
                })
                return NextResponse.json({ ...generation, status: 'FAILED' })
            }
        }

        // Still pending
        return NextResponse.json(generation)

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        await prisma.voiceGeneration.delete({
            where: { id: parseInt(id) }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
}
