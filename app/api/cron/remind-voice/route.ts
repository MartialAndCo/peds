import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'

export async function GET(req: Request) {
    try {
        console.log('[RemindVoice] Checking for stale confirmations...')

        // Criteria:
        // - Status: 'confirming'
        // - updatedAt < 5 minutes ago
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        const staleRequests = await prisma.pendingRequest.findMany({
            where: {
                status: 'confirming',
                updatedAt: { lt: fiveMinutesAgo }
            }
        })

        if (staleRequests.length === 0) {
            return NextResponse.json({ success: true, count: 0 })
        }

        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc }, {})
        const sourcePhone = settings.voice_source_number

        if (!sourcePhone) {
            return NextResponse.json({ success: false, error: 'No source phone' })
        }

        for (const req of staleRequests) {
            console.log(`[RemindVoice] Reminding source for Request ${req.id}`)

            await whatsapp.sendText(sourcePhone, `⚠️ **Reminder**: You have a voice note waiting for confirmation.\n\nReply **OK** to send it.\nReply **NO** to retry.`)

            // Update timestamp to avoid spamming every second (will remind again in 5 mins)
            await prisma.pendingRequest.update({
                where: { id: req.id },
                data: { updatedAt: new Date() } // "touch" the record
            })
        }

        return NextResponse.json({ success: true, count: staleRequests.length })

    } catch (error: any) {
        console.error('[RemindVoice] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
