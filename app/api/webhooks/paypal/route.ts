import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text()
        const headers = req.headers

        console.log("PAYPAL WEBHOOK RECEIVED:", bodyText)

        // TODO: Implement Strict Signature Verification
        // PayPal uses CRC32 and RSA signature with Cert URL. 
        // For MVP/Dev, we might skip strict signature if env vars are missing, or use a simpler secret check if configured.

        const body = JSON.parse(bodyText)

        // Event Type Check
        if (body.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
            console.log(`Ignoring event: ${body.event_type}`)
            return NextResponse.json({ received: true })
        }

        const resource = body.resource
        const amount = resource.amount.value
        const currency = resource.amount.currency_code
        const transactionId = resource.id
        const payerEmail = resource.payer?.email_address
        const payerName = `${resource.payer?.name?.given_name} ${resource.payer?.name?.surname}`

        // Find Contact by matching Payer Email? 
        // Difficult if they use different emails. 
        // Strategy: We just log it for now, and maybe in the future allow "claiming" a payment.
        // OR: If the "custom_id" field was sent during payment link creation, we could link it.
        // For now: Just store it. Is orphan.

        // Idempotency: Check if payment exists
        const existing = await prisma.payment.findUnique({ where: { id: transactionId } })
        if (existing) {
            return NextResponse.json({ received: true, status: 'already_processed' })
        }

        // Save to DB
        await prisma.payment.create({
            data: {
                id: transactionId,
                amount: Number(amount),
                currency: currency,
                status: 'COMPLETED',
                payerEmail: payerEmail,
                payerName: payerName,
                rawJson: bodyText
                // contactId: ??? (Cannot link automatically yet without custom_id logic)
            }
        })

        console.log(`💰 Payment Registered: ${amount} ${currency} from ${payerName}`)

        return NextResponse.json({ received: true })

    } catch (error) {
        console.error("PayPal Webhook Error:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
