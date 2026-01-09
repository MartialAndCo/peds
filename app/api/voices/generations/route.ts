
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const generations = await prisma.voiceGeneration.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                status: true,
                createdAt: true,
                jobId: true,
                error: true,
                voiceModelId: true,
                // audioUrl: false // Exclude for list view
                voiceModel: {
                    select: { name: true }
                }
            }
        })
        return NextResponse.json(generations)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }
}
