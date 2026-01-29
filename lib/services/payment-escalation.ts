import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export interface EscalationTier {
  tier: number
  minAmount: number
  maxAmount: number
  label: string
}

export interface EscalationState {
  currentTier: number
  suggestedAmount: number
  totalPayments: number
  totalReceived: string
  consecutiveRefusals: number
  lastRequestedAmount: number | null
}

/**
 * Escalation Tiers - AGGRESSIVE per user request
 */
export const ESCALATION_TIERS: EscalationTier[] = [
  { tier: 0, minAmount: 30,  maxAmount: 50,  label: 'First Request' },
  { tier: 1, minAmount: 50,  maxAmount: 80,  label: 'Early Trust' },
  { tier: 2, minAmount: 80,  maxAmount: 120, label: 'Established' },
  { tier: 3, minAmount: 120, maxAmount: 180, label: 'Committed' },
  { tier: 4, minAmount: 180, maxAmount: 280, label: 'Deep Investment' },
  { tier: 5, minAmount: 280, maxAmount: 500, label: 'Maximum' }
]

/**
 * Calculate suggested payment amount based on current escalation tier
 */
export async function calculateSuggestedAmount(
  agentId: string,
  contactId: string
): Promise<EscalationState> {

  // Get or create AgentContact
  let agentContact = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId, contactId } }
  })

  if (!agentContact) {
    // Lazy create with defaults
    agentContact = await prisma.agentContact.create({
      data: {
        agentId,
        contactId,
        trustScore: 0,
        phase: 'CONNECTION',
        paymentEscalationTier: 0,
        totalPaymentsReceived: 0,
        totalAmountReceived: new Decimal(0),
        consecutiveRefusals: 0
      }
    })
  }

  const currentTier = agentContact.paymentEscalationTier
  const tierConfig = ESCALATION_TIERS[currentTier] || ESCALATION_TIERS[0]

  // Calculate midpoint with ±5 variance
  const midpoint = (tierConfig.minAmount + tierConfig.maxAmount) / 2
  const variance = (Math.random() * 10) - 5 // -5 to +5
  const suggestedAmount = Math.round(midpoint + variance)

  return {
    currentTier,
    suggestedAmount,
    totalPayments: agentContact.totalPaymentsReceived,
    totalReceived: agentContact.totalAmountReceived.toString(),
    consecutiveRefusals: agentContact.consecutiveRefusals,
    lastRequestedAmount: agentContact.lastRequestedAmount
      ? Number(agentContact.lastRequestedAmount)
      : null
  }
}

/**
 * Escalate tier after confirmed payment
 */
export async function escalateOnPayment(
  agentId: string,
  contactId: string,
  amount: number
): Promise<void> {

  const agentContact = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId, contactId } }
  })

  if (!agentContact) {
    console.warn(`[Escalation] AgentContact not found for agent=${agentId}, contact=${contactId}`)
    return
  }

  const currentTier = agentContact.paymentEscalationTier
  const newTier = Math.min(currentTier + 1, ESCALATION_TIERS.length - 1) // Cap at max tier

  const newTotalPayments = agentContact.totalPaymentsReceived + 1
  const newTotalAmount = new Decimal(agentContact.totalAmountReceived).plus(amount)

  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: {
      paymentEscalationTier: newTier,
      totalPaymentsReceived: newTotalPayments,
      totalAmountReceived: newTotalAmount,
      consecutiveRefusals: 0, // Reset refusals on payment
      lastPaymentDate: new Date()
    }
  })

  console.log(`[Escalation] Payment confirmed: Agent ${agentId}, Contact ${contactId}`)
  console.log(`[Escalation] Tier: ${currentTier} → ${newTier} | Total: ${newTotalPayments} payments ($${newTotalAmount})`)
}

/**
 * De-escalate tier after consecutive refusals
 */
export async function deescalateOnRefusal(
  agentId: string,
  contactId: string
): Promise<void> {

  const agentContact = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId, contactId } }
  })

  if (!agentContact) {
    console.warn(`[Escalation] AgentContact not found for de-escalation`)
    return
  }

  const newRefusals = agentContact.consecutiveRefusals + 1

  let newTier = agentContact.paymentEscalationTier

  // De-escalate after 2 consecutive refusals
  if (newRefusals >= 2) {
    newTier = Math.max(agentContact.paymentEscalationTier - 1, 0) // Floor at tier 0
    console.log(`[Escalation] De-escalating: Tier ${agentContact.paymentEscalationTier} → ${newTier} (${newRefusals} refusals)`)
  }

  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: {
      consecutiveRefusals: newRefusals,
      paymentEscalationTier: newTier
    }
  })

  console.log(`[Escalation] Refusal tracked: Agent ${agentId}, Contact ${contactId} | Refusals: ${newRefusals}`)
}

/**
 * Track that a payment request was made (optional - for analytics)
 */
export async function trackRequest(
  agentId: string,
  contactId: string,
  amount: number
): Promise<void> {

  const agentContact = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId, contactId } }
  })

  if (!agentContact) return

  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: {
      lastRequestedAmount: new Decimal(amount),
      lastRequestDate: new Date()
    }
  })

  console.log(`[Escalation] Request tracked: $${amount}`)
}

// Export as singleton service
export const escalationService = {
  calculateSuggestedAmount,
  escalateOnPayment,
  deescalateOnRefusal,
  trackRequest,
  ESCALATION_TIERS
}
