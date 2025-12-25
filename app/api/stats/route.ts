import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const [contactsCount, activeConversationsCount, promptsCount] = await Promise.all([
            prisma.contact.count(),
            prisma.conversation.count({ where: { status: 'active' } }),
            prisma.prompt.count()
        ])

        return NextResponse.json({
            contactsCount,
            activeConversationsCount,
            promptsCount
        })
    } catch (error) {
        console.error('Stats Error:', error)
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
}
