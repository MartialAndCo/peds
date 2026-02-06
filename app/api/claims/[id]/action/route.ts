import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handlePaymentClaimReaction } from '@/lib/services/payment-claim-handler'

// Reuse the existing logic from payment-claim-handler which already handles DB updates + AI response
// We just need to adapt it to be called from API instead of WhatsApp reaction

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Await params for Next.js 15+ compatibility
    const { id: claimId } = await params

    try {
        const { action } = await req.json() // 'confirm', 'reject'

        if (!['confirm', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        const claim = await prisma.pendingPaymentClaim.findUnique({
            where: { id: claimId },
            include: { contact: true }
        })

        if (!claim) {
            return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
        }

        if (claim.status !== 'PENDING') {
            return NextResponse.json({ error: 'Claim already processed' }, { status: 400 })
        }

        // We reuse the logic from `handlePaymentClaimReaction`
        // But that function expects a `waMessageId` and an `emoji`.
        // We can refactor `handlePaymentClaimReaction` OR call a shared service function.
        // For now, let's look at `handlePaymentClaimReaction` in `payment-claim-handler.ts`.
        // It relies on finding the claim by `waMessageId`. 
        // Here we have the `claimId`.

        // Strategy: We will extract the core logic from `handlePaymentClaimReaction` into a new function 
        // `processPaymentClaimDecision(claimId, decision)` in `payment-claim-handler.ts` 
        // and call it here.

        // For this step (Creating API), I will assume the function exists and I will import it.
        // I will then implement/refactor it in the next step.

        const { processPaymentClaimDecision } = await import('@/lib/services/payment-claim-handler')

        const success = await processPaymentClaimDecision(claimId, action === 'confirm' ? 'CONFIRM' : 'REJECT')

        if (success) {
            // Also mark notification as read if it exists
            // Handle both PAYMENT_CLAIM and PAYMENT_VERIFICATION types
            await prisma.notification.updateMany({
                where: { 
                    entityId: claimId, 
                    type: { in: ['PAYMENT_CLAIM', 'PAYMENT_VERIFICATION'] }
                },
                data: { isRead: true }
            })

            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
        }

    } catch (error) {
        console.error('Claim action error:', error)
        return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
    }
}
