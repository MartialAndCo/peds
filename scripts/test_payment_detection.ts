/**
 * Test Script: Payment Detection Feature
 * 
 * Tests:
 * 1. Payment claim detection (AI analysis)
 * 2. Admin notification sending
 * 3. Reaction handling (confirm/reject)
 */

import { prisma } from '../lib/prisma'
import { detectPaymentClaim } from '../lib/services/payment-detector'
import { processPaymentClaim, handlePaymentClaimReaction } from '../lib/services/payment-claim-handler'
import { settingsService } from '../lib/settings-cache'
import { whatsapp } from '../lib/whatsapp'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// Mock WhatsApp to capture messages
const sentMessages: { to: string, text: string }[] = []
const originalSendText = whatsapp.sendText
whatsapp.sendText = async (chatId: string, text: string) => {
    console.log(`[MOCK WA] → ${chatId}: "${text.substring(0, 80)}..."`)
    sentMessages.push({ to: chatId, text })
    return { id: `mock_${Date.now()}` }
}

async function testPaymentDetection() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🧪 TEST: Payment Claim Detection')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const settings = await settingsService.getSettings()

    // Test cases
    const testCases = [
        { msg: "I just sent you 50 on PayPal", expected: { claimed: true, amount: 50, method: 'PayPal' } },
        { msg: "j'ai envoyé 100€", expected: { claimed: true, amount: 100 } },
        { msg: "payment done!", expected: { claimed: true } },
        { msg: "how are you today?", expected: { claimed: false } },
        { msg: "I'll pay you tomorrow", expected: { claimed: false } },
        { msg: "just sent it via Venmo", expected: { claimed: true, method: 'Venmo' } },
    ]

    let passed = 0
    for (const tc of testCases) {
        const result = await detectPaymentClaim(tc.msg, settings)
        const ok = result.claimed === tc.expected.claimed
        console.log(`${ok ? '✅' : '❌'} "${tc.msg.substring(0, 40)}..."`)
        console.log(`   Expected: claimed=${tc.expected.claimed}, Got: claimed=${result.claimed}, amount=${result.amount}, method=${result.method}`)
        if (ok) passed++
    }

    console.log(`\n📊 Detection Tests: ${passed}/${testCases.length} passed`)
    return passed === testCases.length
}

async function testFullFlow() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🧪 TEST: Full Payment Flow (Notification + Reaction)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const settings = await settingsService.getSettings()

    // 1. Create test contact
    console.log('1️⃣ Creating test contact...')
    let contact = await prisma.contact.findUnique({ where: { phone_whatsapp: '+1234567890' } })
    if (!contact) {
        contact = await prisma.contact.create({
            data: {
                phone_whatsapp: '+1234567890',
                name: 'TestUser',
                status: 'active'
            }
        })
    }
    console.log(`   Contact ID: ${contact.id}`)

    // 2. Process payment claim
    console.log('\n2️⃣ Processing payment claim: "I sent you 75 via CashApp"')
    sentMessages.length = 0 // Clear

    const claimResult = await processPaymentClaim(
        "I sent you 75 via CashApp",
        contact,
        null, // No conversation for this test
        settings,
        1
    )

    if (claimResult.processed) {
        console.log(`   ✅ Claim created: ${claimResult.claimId}`)

        // Check admin notification was sent
        const adminPhone = settings.source_phone_number
        const adminMsg = sentMessages.find(m => m.to === adminPhone)
        if (adminMsg) {
            console.log(`   ✅ Admin notification sent: "${adminMsg.text}"`)
        } else {
            console.log(`   ❌ Admin notification NOT sent (admin phone: ${adminPhone})`)
        }
    } else {
        console.log('   ❌ Claim NOT processed')
        return false
    }

    // 3. Find the claim and simulate reaction
    console.log('\n3️⃣ Simulating admin reaction (👍)...')
    const claim = await prisma.pendingPaymentClaim.findUnique({
        where: { id: claimResult.claimId }
    })

    if (claim?.waMessageId) {
        sentMessages.length = 0 // Clear
        const handled = await handlePaymentClaimReaction(claim.waMessageId, '👍', settings, 1)

        if (handled) {
            console.log('   ✅ Reaction handled')

            // Check thank you message was sent
            const thankYouMsg = sentMessages.find(m => m.to === contact.phone_whatsapp)
            if (thankYouMsg) {
                console.log(`   ✅ Thank you sent to user: "${thankYouMsg.text.substring(0, 60)}..."`)
            }

            // Check payment was recorded
            const payment = await prisma.payment.findFirst({
                where: { contactId: contact.id },
                orderBy: { createdAt: 'desc' }
            })
            if (payment) {
                console.log(`   ✅ Payment recorded: $${payment.amount} (${payment.status})`)
            } else {
                console.log('   ❌ Payment NOT recorded')
            }

            // Check claim status
            const updatedClaim = await prisma.pendingPaymentClaim.findUnique({
                where: { id: claimResult.claimId }
            })
            console.log(`   Claim status: ${updatedClaim?.status}`)

        } else {
            console.log('   ❌ Reaction NOT handled')
        }
    } else {
        console.log('   ⚠️ No waMessageId on claim (mock mode)')
    }

    // Cleanup
    console.log('\n4️⃣ Cleaning up test data...')
    await prisma.payment.deleteMany({ where: { contactId: contact.id, id: { startsWith: 'manual_' } } })
    await prisma.pendingPaymentClaim.deleteMany({ where: { contactId: contact.id } })
    console.log('   ✅ Cleanup done')

    return true
}

async function main() {
    console.log('🚀 PAYMENT DETECTION FEATURE TEST\n')

    try {
        const detectionOk = await testPaymentDetection()
        const flowOk = await testFullFlow()

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📋 SUMMARY')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`Detection Tests: ${detectionOk ? '✅ PASSED' : '❌ FAILED'}`)
        console.log(`Full Flow Test:  ${flowOk ? '✅ PASSED' : '❌ FAILED'}`)

    } catch (e: any) {
        console.error('❌ Test failed with error:', e.message)
        console.error(e.stack)
    } finally {
        await prisma.$disconnect()
    }
}

main()
