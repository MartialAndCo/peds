import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { settingsService } from '@/lib/settings-cache'
import { whatsapp, getConfig } from '@/lib/whatsapp'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await prisma.setting.findMany()
    // Convert array to object
    const settingsMap = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {} as Record<string, string>)

    // If critical keys are missing, populate with active defaults (Env or Hardcoded)
    if (!settingsMap['waha_api_key'] || !settingsMap['waha_endpoint']) {
        const defaults = await getConfig()
        if (!settingsMap['waha_api_key']) settingsMap['waha_api_key'] = defaults.apiKey
        if (!settingsMap['waha_endpoint']) settingsMap['waha_endpoint'] = defaults.endpoint
    }

    return NextResponse.json(settingsMap)
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const json = await req.json()
        // json is object { key: value, key2: value2 }

        const updates = Object.entries(json).map(([key, value]) => {
            return prisma.setting.upsert({
                where: { key },
                update: { value: String(value).trim() },
                create: { key, value: String(value).trim() }
            })
        })

        await prisma.$transaction(updates)
        settingsService.invalidate()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
