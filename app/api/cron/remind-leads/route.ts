import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'

export async function GET(req: Request) {
    try {
        console.log('[RemindLeads] Checking for stalled lead confirmations...')

        // We can't query JSON fields easily with Prisma + SQLite/Postgres across types without RawQuery sometimes.
        // But for Postgres `path` filtering is supported.
        // Let's iterate instead for safety if dataset is small, or use path filter.
        // Metadata is Json?

        // Fetch all conversations that might be in CONFIRMING state.
        // Optimization: Filter by `status: 'active'` (Lead provider conv is active)
        const activeConvs = await prisma.conversation.findMany({
            where: {
                status: 'active',
                metadata: {
                    path: ['state'],
                    equals: 'CONFIRMING'
                }
            },
            include: { contact: true }
        })

        const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000)
        let sentCount = 0

        for (const conv of activeConvs) {
            const metadata: any = conv.metadata || {}

            // Check State (Double check)
            if (metadata.state !== 'CONFIRMING') continue;

            const lastReminderStr = metadata.lastReminder
            const lastReminder = lastReminderStr ? new Date(lastReminderStr) : new Date(0) // Default to old if missing

            if (lastReminder < oneMinuteAgo) {
                // SEND REMINDER
                console.log(`[RemindLeads] Reminding Provider ${conv.contact.phone_whatsapp}`)

                await whatsapp.sendText(conv.contact.phone_whatsapp, `⚠️ **Reminder**: Lead waiting for validation.\n\nTarget: ${metadata.draft?.phone}\n\nReply **OK** to send.\nReply **CANCEL** to drop.`)

                // Update Metadata
                const newMetadata = {
                    ...metadata,
                    lastReminder: new Date()
                }

                await prisma.conversation.update({
                    where: { id: conv.id },
                    data: { metadata: newMetadata }
                })

                sentCount++
            }
        }

        return NextResponse.json({ success: true, count: sentCount })

    } catch (error: any) {
        console.error('[RemindLeads] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
