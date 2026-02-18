import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SANDBOX_PHONE = 'SANDBOX_CLIENT'

export async function POST() {
    try {
        console.log('Resetting Sandbox...')

        // 1. Find Contact
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: SANDBOX_PHONE }
        })

        if (!contact) {
            return NextResponse.json({ success: true, message: 'Nothing to reset' })
        }

        // 2. Delete Mem0
        try {
            const { memoryService } = require('@/lib/memory')
            await memoryService.deleteAll(SANDBOX_PHONE)
        } catch (e) {
            console.error('Failed to clear memory', e)
        }

        // 3. Delete Cascade (Contact -> Conversation -> Messages)
        // Since we fixed cascade delete in API but maybe not schema, let's do manual to be safe or reuse delete logic
        // We'll just delete the contact, if cascade is set in schema it works, 
        // if not we might orphan messages. 
        // Let's do a deep clean similar to contact delete route to be sure.

        const conversations = await prisma.conversation.findMany({ where: { contactId: contact.id }, select: { id: true } })
        const ids = conversations.map(c => c.id)

        if (ids.length > 0) {
            await prisma.message.deleteMany({ where: { conversationId: { in: ids } } })
            await prisma.supervisorAlert.deleteMany({ where: { conversationId: { in: ids } } })
            await prisma.conversation.deleteMany({ where: { contactId: contact.id } })
        }

        await prisma.contact.delete({ where: { id: contact.id } })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
