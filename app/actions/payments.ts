'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createManualPayment(data: {
    agentId: string
    contactId?: string // If selected existing
    contactName?: string // If new
    contactPhone?: string // If new
    amount: number
    method: string
    note?: string
    isNewContact: boolean
}) {
    try {
        console.log('[Payment] Creating manual payment:', data)
        let contactId = data.contactId

        // 1. Handle Contact Creation if New
        if (data.isNewContact) {
            if (!data.contactName || !data.contactPhone) {
                return { success: false, error: "Name and Phone required for new contact" }
            }

            // Check if exists by phone to avoid duplicates
            let contact = await prisma.contact.findUnique({
                where: { phone_whatsapp: data.contactPhone }
            })

            if (!contact) {
                contact = await prisma.contact.create({
                    data: {
                        name: data.contactName,
                        phone_whatsapp: data.contactPhone,
                        source: 'manual_entry',
                        status: 'active',
                        profile: {
                            age: 25,
                            job: 'Unknown',
                            location: 'Unknown',
                            name: data.contactName
                        }
                    }
                })
            }
            contactId = contact.id
        }

        if (!contactId) return { success: false, error: "Contact resolution failed" }

        // 2. Ensure AgentContact Link
        await prisma.agentContact.upsert({
            where: {
                agentId_contactId: {
                    agentId: data.agentId,
                    contactId: contactId
                }
            },
            update: {
                phase: 'MONEYPOT', // Force to moneypot as they paid
                trustScore: Math.max(80, 0) // Boost trust
            },
            create: {
                agentId: data.agentId,
                contactId: contactId,
                phase: 'MONEYPOT',
                trustScore: 80
            }
        })

        // 3. Create Payment
        const paymentId = `MANUAL-${Date.now()}`
        await prisma.payment.create({
            data: {
                id: paymentId,
                amount: data.amount,
                currency: 'EUR', // Default for manual
                status: 'COMPLETED',
                payerName: data.contactName || 'Manual Unknown',
                method: data.method,
                contactId: contactId,
                rawJson: JSON.stringify({ note: data.note || 'Manual entry by admin' })
            }
        })

        // NEW: Trigger escalation for manual payments
        const { escalationService } = require('@/lib/services/payment-escalation')
        await escalationService.escalateOnPayment(
            data.agentId,
            contactId,
            data.amount
        )

        revalidatePath('/workspace')
        return { success: true }
    } catch (e: any) {
        console.error('Manual payment error:', e)
        return { success: false, error: e.message }
    }
}

export async function searchContacts(query: string) {
    if (!query || query.length < 2) return []

    return await prisma.contact.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone_whatsapp: { contains: query } }
            ]
        },
        take: 5,
        select: { id: true, name: true, phone_whatsapp: true }
    })
}
