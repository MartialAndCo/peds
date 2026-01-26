
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    try {
        const voices = await prisma.voiceModel.findMany({
            orderBy: { name: 'asc' }
        })
        return NextResponse.json(voices)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const { name, voiceSampleUrl, gender, language } = body

        if (!name || !voiceSampleUrl) {
            return NextResponse.json({ error: 'Name and Voice Sample URL required' }, { status: 400 })
        }

        const voice = await prisma.voiceModel.create({
            data: {
                name,
                voiceSampleUrl,
                gender: gender || 'FEMALE',
                language: language || 'Auto'
            }
        })
        return NextResponse.json(voice)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create voice' }, { status: 500 })
    }
}
