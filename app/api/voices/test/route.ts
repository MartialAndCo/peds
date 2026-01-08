
import { NextResponse } from 'next/server'
import { rvcService } from '@/lib/rvc'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const { audio, voiceId } = body

        if (!audio || !voiceId) {
            return NextResponse.json({ error: 'Audio and Voice ID required' }, { status: 400 })
        }

        const converted = await rvcService.convertVoice(audio, { voiceId: parseInt(voiceId) })

        if (!converted) {
            return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
        }

        return NextResponse.json({ audio: converted })
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
