// app/api/notifications/tts-action/route.ts
// Handle admin actions on TTS failure notifications (Continue/Pause)

import { NextRequest, NextResponse } from 'next/server'
import { voiceTtsService } from '@/lib/voice-tts'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { notificationId, action } = body

        if (!notificationId) {
            return NextResponse.json({ error: 'notificationId is required' }, { status: 400 })
        }

        if (!action || !['continue', 'pause'].includes(action)) {
            return NextResponse.json({ error: 'action must be "continue" or "pause"' }, { status: 400 })
        }

        console.log(`[TTS-Action] Processing ${action} for notification ${notificationId}`)

        const result = await voiceTtsService.handleAdminResponse(notificationId, action)

        if (!result.success) {
            return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
        }

        const message = action === 'pause'
            ? 'Conversation paused'
            : 'Shy refusal sent to contact'

        return NextResponse.json({
            success: true,
            action,
            message
        })

    } catch (error: any) {
        console.error('[TTS-Action] Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
