import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { qwenTtsService } from '@/lib/qwen-tts'
import { voiceTtsService } from '@/lib/voice-tts'

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { text } = await req.json()
        if (!text?.trim()) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        const { id: idStr } = await params
        const conversation = await prisma.conversation.findUnique({
            where: { id: parseInt(idStr) },
            include: { contact: true }
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        const agentId = conversation.agentId
        if (!agentId) {
            return NextResponse.json({ error: 'No agent assigned to this conversation' }, { status: 400 })
        }

        // Get agent for locale and voice model
        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            include: { voiceModel: true, profile: true }
        })

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
        }

        if (!agent.voiceModel?.voiceSampleUrl) {
            return NextResponse.json({ error: 'No voice model configured for this agent' }, { status: 400 })
        }

        const locale = agent.profile?.locale || agent.language || 'en-US'

        // 1. Preprocess text for natural spoken delivery
        console.log(`[VoicePreview] Preprocessing text for vocal: "${text.substring(0, 50)}..."`)
        const vocalReadyText = await voiceTtsService.preprocessForVocal(text, locale)

        // 2. Generate TTS audio
        console.log(`[VoicePreview] Generating TTS with voice: ${agent.voiceModel.name}`)
        const ttsResult = await qwenTtsService.generateVoice({
            text: vocalReadyText,
            voiceId: agent.voiceModelId!,
            agentId: agentId,
            language: locale.startsWith('fr') ? 'French' : 'English',
            skipTranscription: true
        })

        if (!ttsResult.audioBase64) {
            return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            audioBase64: ttsResult.audioBase64,
            processedText: vocalReadyText
        })

    } catch (error: any) {
        console.error('[VoicePreview] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
