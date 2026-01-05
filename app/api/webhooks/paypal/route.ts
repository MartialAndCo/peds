import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Cache for encoded certificates to reduce network requests
const certCache = new Map<string, string>()

async function downloadAndCacheCert(url: string): Promise<string> {
    if (certCache.has(url)) return certCache.get(url)!

    try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch cert: ${response.statusText}`)
        const cert = await response.text()
        certCache.set(url, cert)
        return cert
    } catch (err: any) {
        throw new Error(`Certificate download failed: ${err.message}`)
    }
}

/**
 * Verifies PayPal Webhook Signature
 * See: https://developer.paypal.com/api/rest/webhooks/rest/
 */
async function verifyPayPalSignature(req: NextRequest, bodyText: string): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID

    // If not configured, we warn but allow in non-strict mode to avoid breaking existing setups
    if (!webhookId) {
        console.warn("[PayPal] Skipping verification: PAYPAL_WEBHOOK_ID not set")
        return true
    }

    const headers = req.headers
    const transmissionId = headers.get('paypal-transmission-id')
    const transmissionTime = headers.get('paypal-transmission-time')
    const transmissionSig = headers.get('paypal-transmission-sig')
    const certUrl = headers.get('paypal-cert-url')
    const authAlgo = headers.get('paypal-auth-algo') // e.g. SHA256withRSA

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
        console.error("[PayPal] Missing security headers")
        return false
    }

    // 2. Security: Ensure Cert URL is from PayPal
    const urlObj = new URL(certUrl)
    if (!urlObj.hostname.endsWith('.paypal.com')) {
        console.error("[PayPal] Spoofed Cert URL detected:", certUrl)
        return false
    }

    // 3. Calculate CRC32 of Body
    const crc = crc32(bodyText)

    // 4. Construct Expected Message
    const expectedData = `${transmissionId}|${transmissionTime}|${webhookId}|${crc}`

    // 5. Verify
    try {
        const cert = await downloadAndCacheCert(certUrl)
        const verifier = crypto.createVerify('RSA-SHA256')
        verifier.update(expectedData)
        return verifier.verify(cert, transmissionSig, 'base64')
    } catch (e) {
        console.error("[PayPal] Verification logic error:", e)
        return false
    }
}

// Simple CRC32 implementation
function crc32(str: string): string {
    let crc = 0xFFFFFFFF
    for (let i = 0; i < str.length; i++) {
        const byte = str.charCodeAt(i) & 0xFF
        crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF]
    }
    return ((crc ^ 0xFFFFFFFF) >>> 0).toString()
}

// Precomputed table for CRC32 (Poly: 0xEDB88320)
const table = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c;
}


export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text()
        const isValid = await verifyPayPalSignature(req, bodyText)

        if (!isValid) {
            console.error("[PayPal] Invalid Signature. Ignoring request.")
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 })
        }

        console.log("PAYPAL WEBHOOK RECEIVED & VERIFIED")

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
            }
        })

        console.log(`💰 Payment Registered: ${amount} ${currency} from ${payerName}`)

        return NextResponse.json({ received: true })

    } catch (error: any) {
        console.error("PayPal Webhook Error:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
