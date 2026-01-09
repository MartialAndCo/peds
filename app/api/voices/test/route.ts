
import { NextResponse } from 'next/server'
import { rvcService } from '@/lib/rvc'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const { audio, voiceId, sourceGender } = body

        if (!audio || !voiceId) {
            return NextResponse.json({ error: 'Audio and Voice ID required' }, { status: 400 })
        }

        console.log(`[VoiceTest] Starting Async Job for Voice ${voiceId}`)
        const jobId = await rvcService.startJob(audio, {
            voiceId: parseInt(voiceId),
            sourceGender
        })

        if (!jobId) {
            return NextResponse.json({ error: 'Failed to start RVC Job' }, { status: 500 })
        }

        // Save PENDING State
        const generation = await prisma.voiceGeneration.create({
            data: {
                voiceModelId: parseInt(voiceId),
                status: 'PENDING',
                jobId: jobId
            }
        })

        return NextResponse.json({
            status: 'PENDING',
            jobId,
            generationId: generation.id
        })

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
