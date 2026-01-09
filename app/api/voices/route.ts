
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
        const { name, url, gender, indexRate, protect, rmsMixRate } = body

        if (!name || !url) {
            return NextResponse.json({ error: 'Name and URL required' }, { status: 400 })
        }

        const voice = await prisma.voiceModel.create({
            data: {
                name,
                url,
                gender: gender || 'FEMALE',
                indexRate: indexRate || 0.75,
                protect: protect || 0.33,
                rmsMixRate: rmsMixRate || 0.25
            }
        })
        return NextResponse.json(voice)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create voice' }, { status: 500 })
    }
}
