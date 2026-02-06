import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/provider/check-duplicate?identifier=xxx&type=WHATSAPP
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'PROVIDER') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const identifier = searchParams.get('identifier')
        const type = searchParams.get('type')

        if (!identifier) {
            return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
        }

        // Normalize identifier
        let normalizedIdentifier = identifier.replace(/\s/g, '')
        if (type === 'WHATSAPP' && /^0[67]/.test(normalizedIdentifier)) {
            normalizedIdentifier = '+33' + normalizedIdentifier.substring(1)
        }

        // Check for existing lead
        const existingLead = await prisma.lead.findFirst({
            where: { identifier: normalizedIdentifier },
            include: {
                provider: { select: { email: true } },
                agent: { select: { name: true } }
            }
        })

        if (existingLead) {
            return NextResponse.json({
                exists: true,
                type: 'LEAD',
                leadId: existingLead.id,
                status: existingLead.status,
                addedBy: existingLead.provider.email,
                agent: existingLead.agent.name,
                createdAt: existingLead.createdAt
            })
        }

        // Check for existing contact
        const existingContact = await prisma.contact.findFirst({
            where: {
                OR: [
                    { phone_whatsapp: normalizedIdentifier },
                    { discordId: normalizedIdentifier }
                ]
            },
            include: {
                conversations: {
                    take: 1,
                    include: { agent: { select: { name: true } } }
                }
            }
        })

        if (existingContact) {
            return NextResponse.json({
                exists: true,
                type: 'CONTACT',
                contactId: existingContact.id,
                status: existingContact.status,
                agent: existingContact.conversations[0]?.agent?.name || 'Unknown'
            })
        }

        return NextResponse.json({ exists: false })
    } catch (e: any) {
        console.error('Check Duplicate Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
