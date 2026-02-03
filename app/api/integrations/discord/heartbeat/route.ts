
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
    try {
        const headers = req.headers
        const secret = headers.get('x-internal-secret')

        // 1. Verify Secret
        if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { botId, username } = body

        if (!botId || !username) {
            return NextResponse.json({ error: 'Missing botId or username' }, { status: 400 })
        }

        // 2. Register/Update Bot
        const bot = await prisma.discordBot.upsert({
            where: { id: botId },
            update: {
                username,
                lastSeen: new Date()
            },
            create: {
                id: botId,
                username,
                lastSeen: new Date()
            }
        })

        return NextResponse.json({ success: true, bot })
    } catch (error: any) {
        logger.error('Failed to register Discord heartbeat', { error })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
