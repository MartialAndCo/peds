'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function updateContactStatus(contactId: string, status: string) {
    await prisma.contact.update({
        where: { id: contactId },
        data: { status }
    })
    revalidatePath('/workspace')
}

export async function updateConversationStatus(conversationId: number, status: string) {
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { status }
    })
    revalidatePath('/workspace')
}

export async function updateConversationAi(conversationId: number, enabled: boolean) {
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { ai_enabled: enabled }
    })
    revalidatePath('/workspace')
}

export async function updateContactTestMode(contactId: string, enabled: boolean) {
    await prisma.contact.update({
        where: { id: contactId },
        data: { testMode: enabled }
    })
    revalidatePath('/workspace')
}

export async function getExportData(conversationId: number) {
    // 1. Get Conversation to find Contact
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true }
    })

    if (!conversation) throw new Error("Conversation not found")

    const contactId = conversation.contactId

    // 2. Fetch ALL messages for this contact (across all conversations)
    // Ordered chronologically
    const allMessages = await prisma.message.findMany({
        where: {
            conversation: { contactId: contactId }
        },
        orderBy: { timestamp: 'asc' },
        include: { conversation: { select: { status: true } } }
    })

    // 3. Filter Photos (Received Only)
    // Look for images or mediaUrl with image mime (inferred)
    const photos = allMessages.filter(m =>
        m.sender === 'contact' &&
        m.mediaUrl &&
        (m.mediaUrl.endsWith('.jpg') || m.mediaUrl.endsWith('.jpeg') || m.mediaUrl.endsWith('.png') || m.mediaUrl.startsWith('data:image'))
    ).map(m => ({
        url: m.mediaUrl,
        timestamp: m.timestamp
    }))

    // 4. Format History
    const history = allMessages.map(m => ({
        timestamp: m.timestamp,
        sender: m.sender,
        text: m.message_text,
        media: m.mediaUrl || null
    }))

    return {
        contact: conversation.contact,
        photos,
        history
    }
}
