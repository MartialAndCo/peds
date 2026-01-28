
import { NextResponse } from 'next/server'
import { qwenTtsService } from '@/lib/qwen-tts'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const { text, voiceId, voiceSampleUrl, language, skipTranscription, customVoice } = body

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        if (!voiceId && !voiceSampleUrl && !customVoice) {
            return NextResponse.json({ error: 'Voice ID, Voice Sample URL, or Custom Voice required' }, { status: 400 })
        }

        console.log(`[VoiceTest] Starting TTS Job - ${customVoice ? `Custom Voice: ${customVoice}` : `Voice ID: ${voiceId}`}`)

        const jobId = await qwenTtsService.startJob({
            text,
            voiceId: voiceId ? parseInt(voiceId) : undefined,
            voiceSampleUrl,
            language,
            skipTranscription,
            customVoice
        })

        if (!jobId) {
            return NextResponse.json({ error: 'Failed to start TTS Job' }, { status: 500 })
        }

        // Save PENDING State
        // For custom voices, voiceModelId is optional
        const generationData: any = {
            inputText: text,
            status: 'PENDING',
            jobId: jobId
        }

        if (voiceId) {
            generationData.voiceModelId = parseInt(voiceId)
        }

        const generation = await prisma.voiceGeneration.create({
            data: generationData
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
