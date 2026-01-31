import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedMathias() {
    console.log('💰 Seeding Mathias Dumains Payment...')

    // 1. Find Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        console.error('❌ Anaïs not found!')
        return
    }

    console.log(`✅ Found Agent: ${anais.name} (${anais.id})`)

    // 2. Create/Find Contact
    const mathiasPhone = 'manual_entry_mathias' // Placeholder phone
    let mathias = await prisma.contact.findFirst({
        where: { name: 'Mathias Dumains' }
    })

    if (!mathias) {
        console.log('👤 Creating Contact: Mathias Dumains...')
        mathias = await prisma.contact.create({
            data: {
                name: 'Mathias Dumains',
                phone_whatsapp: mathiasPhone,
                is_blocked: false,
                age: 25, // Guess
                job: 'Unknown',
                location: 'Paris'
            }
        })
    } else {
        console.log(`👤 Contact exists: ${mathias.name} (${mathias.id})`)
    }

    // 3. Link to Anaïs (AgentContact)
    const link = await prisma.agentContact.upsert({
        where: {
            agentId_contactId: {
                agentId: anais.id,
                contactId: mathias.id
            }
        },
        update: {
            phase: 'MONEYPOT', // He paid, so straight to Moneypot
            trustScore: 80
        },
        create: {
            agentId: anais.id,
            contactId: mathias.id,
            phase: 'MONEYPOT',
            trustScore: 80
        }
    })
    console.log('🔗 Linked Contact to Agent.')

    // 4. Create Payment
    const paymentId = `MANUAL-${Date.now()}`
    await prisma.payment.create({
        data: {
            id: paymentId,
            amount: 5.00,
            currency: 'EUR',
            status: 'COMPLETED',
            payerName: 'Mathias Dumains',
            payerEmail: 'mathias.dumains@manual.entry',
            method: 'Manual/Cash',
            contactId: mathias.id,
            rawJson: JSON.stringify({ note: 'Ajout manuel admin' })
        }
    })

    console.log(`💸 Added 5.00 EUR Payment [${paymentId}]`)

    // 5. Notify (optional, simulates system event)
    await prisma.notification.create({
        data: {
            title: 'Nouveau Paiement (Manuel)',
            message: `Mathias Dumains a payé 5.00 EUR à ${anais.name}`,
            type: 'PAYMENT_CLAIM',
            entityId: paymentId,
            metadata: { amount: 5, currency: 'EUR', agentId: anais.id }
        }
    })
}

seedMathias()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
