
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

        const converted = await rvcService.convertVoice(audio, {
            voiceId: parseInt(voiceId),
            sourceGender
        })

        if (!converted) {
            console.error('RVC Conversion returned null/failed')
            return NextResponse.json({ error: 'Conversion failed (Check RunPod logs or Settings)' }, { status: 500 })
        }

        // Save to History
        // Save to History
        await prisma.voiceGeneration.create({
            data: {
                voiceModelId: parseInt(voiceId),
                audioUrl: converted
            }
        })

        return NextResponse.json({ audio: converted })
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
