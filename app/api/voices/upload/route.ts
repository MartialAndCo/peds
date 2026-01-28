
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { qwenTtsService } from '@/lib/qwen-tts'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    // 1. Auth Check
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Parse Request
    try {
        const body = await req.json()
        const {
            text,              // Required: Text to generate
            voiceId,           // Required: Voice model ID
            voiceSampleUrl,    // Optional: Override voice sample URL
            customVoiceSample, // Optional: Base64 audio sample
            language,          // Optional: Override language
            skipTranscription, // Optional: Skip transcription for faster processing
            customVoice        // Optional: Custom voice preset ID
        } = body

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        if (!voiceId) {
            return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 })
        }

        // 3. Get voice model
        const voice = await prisma.voiceModel.findUnique({
            where: { id: parseInt(voiceId) }
        })

        if (!voice) {
            return NextResponse.json({ error: 'Voice model not found' }, { status: 404 })
        }

        // 4. Determine voice sample to use (priority: customVoiceSample > voiceSampleUrl > voice.voiceSampleUrl)
        let finalVoiceSample = voice.voiceSampleUrl

        if (voiceSampleUrl) {
            finalVoiceSample = voiceSampleUrl
        }

        if (customVoiceSample) {
            // Custom sample is base64 - use it directly
            finalVoiceSample = customVoiceSample
        }

        // 5. Start TTS Job
        const jobId = await qwenTtsService.startJob({
            text,
            voiceSampleUrl: finalVoiceSample,
            language: language || voice.language || 'Auto',
            skipTranscription: skipTranscription ?? false,
            customVoice
        })

        if (!jobId) {
            return NextResponse.json({ error: 'Failed to start TTS job' }, { status: 500 })
        }

        // 5. Create Generation Record
        const generation = await prisma.voiceGeneration.create({
            data: {
                voiceModelId: parseInt(voiceId),
                inputText: text,
                status: 'PENDING',
                jobId: jobId
            }
        })

        console.log(`[TTS-Upload] Job ${jobId} started, Generation ID: ${generation.id}`)

        return NextResponse.json({
            success: true,
            generationId: generation.id,
            jobId
        })

    } catch (e: any) {
        console.error('[TTS-Upload] Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
