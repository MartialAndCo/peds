import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { profilerService } from '@/lib/profiler'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        // Verify contact exists
        const contact = await prisma.contact.findUnique({
            where: { id },
            select: { id: true, name: true, phone_whatsapp: true }
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        console.log(`[API] Manual profile extraction for contact: ${contact.name || contact.phone_whatsapp}`)

        // Run profiler
        await profilerService.updateProfile(id)

        // Update timestamp
        await prisma.contact.update({
            where: { id },
            data: { lastProfileUpdate: new Date() }
        })

        // Fetch updated contact with profile
        const updatedContact = await prisma.contact.findUnique({
            where: { id },
            select: { profile: true, lastProfileUpdate: true }
        })

        return NextResponse.json({
            success: true,
            profile: updatedContact?.profile,
            timestamp: updatedContact?.lastProfileUpdate
        })

    } catch (error: any) {
        console.error('[API] Profile extraction failed:', error)
        return NextResponse.json({
            error: 'Extraction failed',
            message: error.message
        }, { status: 500 })
    }
}
