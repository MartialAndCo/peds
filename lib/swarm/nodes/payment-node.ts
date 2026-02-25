import { SwarmState } from '../types'
import { classifyPaymentIntent } from '@/lib/services/payment-intent-classifier'

function isPotentialPaymentIntent(message: string): boolean {
  const msg = (message || '').toLowerCase()
  return /\b(pay|paid|payment|paypal|venmo|cashapp|zelle|bank|virement|argent|money|\$|€|envoye|envoyé|sent|transfer)\b/i.test(
    msg
  )
}

export async function paymentNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] paymentNode: Analyse contexte paiement')
  const metadata = state.metadata || {}

  const { settings, profile } = state
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr')

  console.log(
    `[Swarm][Payment] Agent ${state.agentId}: ${settings.payment_paypal_enabled ? 'PayPal ON' : 'PayPal OFF'}`
  )

  const methods: string[] = []

  if (settings.payment_paypal_enabled && settings.payment_paypal_username) {
    methods.push(`PayPal: ${settings.payment_paypal_username}`)
  }

  if (settings.payment_venmo_enabled && settings.payment_venmo_username) {
    methods.push(`Venmo: ${settings.payment_venmo_username}`)
  }

  if (settings.payment_cashapp_enabled && settings.payment_cashapp_username) {
    methods.push(`CashApp: ${settings.payment_cashapp_username}`)
  }

  if (settings.payment_zelle_enabled && settings.payment_zelle_username) {
    methods.push(`Zelle: ${settings.payment_zelle_username}`)
  }

  if (settings.payment_bank_enabled && profile?.bankAccountNumber) {
    methods.push(
      isFrench
        ? `Virement: Account ${profile.bankAccountNumber}, Routing ${profile.bankRoutingNumber}`
        : `Bank: Account ${profile.bankAccountNumber}, Routing ${profile.bankRoutingNumber}`
    )
  }

  try {
    if (settings.payment_custom_methods) {
      const customs = JSON.parse(settings.payment_custom_methods)
      customs.forEach((c: any) => {
        if (c.name && c.value) methods.push(`${c.name}: ${c.value}`)
      })
    }
  } catch (e) {
    console.error('Failed to parse custom payment methods', e)
  }

  const methodsText =
    methods.length > 0
      ? methods.join('\n')
      : isFrench
        ? '(Aucune méthode configurée)'
        : '(No payment methods configured)'

  const shouldRunClassifier =
    state.intention?.besoinPayment === true || isPotentialPaymentIntent(state.userMessage)

  let classification: { intent: 'VERIFICATION' | 'CONFIRMATION' | 'NONE'; confidence: number; reason: string } = {
    intent: 'NONE',
    confidence: 1,
    reason: 'Deterministic gate: not payment related'
  }

  if (shouldRunClassifier) {
    try {
      const history = state.messages.slice(-10).map((m) => ({
        role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content
      }))

      classification = await classifyPaymentIntent(state.userMessage, history, settings.venice_api_key)
      console.log('[Swarm] paymentNode classification:', classification)
    } catch (error) {
      console.error('[Swarm] paymentNode classification error:', error)
      classification = { intent: 'NONE', confidence: 0, reason: 'Error' }
    }
  } else {
    console.log('[Swarm] paymentNode deterministic gate skipped LLM classifier')
  }

  let confirmationInstructions = ''

  if (classification.intent === 'VERIFICATION') {
    confirmationInstructions = isFrench
      ? `

⚠️ L'UTILISATEUR DEMANDE SI TU AS REÇU LE PAIEMENT:
→ Réponds que tu vas vérifier
→ Utilise [VERIFY_PAYMENT] à la fin de ta réponse
→ NE PAS confirmer avoir reçu [PAIEMENT_REÇU]
→ Attends confirmation manuelle de l'admin`
      : `

⚠️ USER IS ASKING IF YOU RECEIVED THE PAYMENT:
→ Say you're going to check
→ Use [VERIFY_PAYMENT] tag at the end
→ DO NOT confirm with [PAYMENT_RECEIVED]
→ Wait for manual admin validation`
  } else if (classification.intent === 'CONFIRMATION') {
    confirmationInstructions = isFrench
      ? `

⚠️ UTILISATEUR CONFIRME AVOIR DÉJÀ ENVOYÉ L'ARGENT:
→ Réagis avec surprise/joie
→ Remercie immédiatement
→ Utilise [PAIEMENT_REÇU] à la fin`
      : `

⚠️ USER CONFIRMS THEY ALREADY SENT MONEY:
→ React with surprise/joy
→ Thank immediately
→ Use [PAYMENT_RECEIVED] at the end`
  } else {
    confirmationInstructions = isFrench
      ? `

🚫 INTERDICTION ABSOLUE:
→ NE JAMAIS utiliser [PAIEMENT_REÇU] ou [PAYMENT_RECEIVED]
→ Le message n'est pas lié à un paiement`
      : `

🚫 ABSOLUTE FORBIDDEN:
→ NEVER use [PAYMENT_RECEIVED] or [PAIEMENT_REÇU]
→ Message is not payment related`
  }

  const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
  const agentAge = profile?.baseAge || 15
  const paymentRules = (
    profile?.paymentRules ||
    (isFrench
      ? 'Si on propose de payer → ACCEPTE avec enthousiasme. Attends confirmation avant [PAIEMENT_REÇU].'
      : 'If offered money → ACCEPT enthusiastically. Wait confirmation before [PAYMENT_RECEIVED].')
  )
    .replace(/\{\{PLATFORM\}\}/g, platformName)
    .replace(/\{\{AGE\}\}/g, agentAge.toString())

  const paymentContext = `[PAIEMENT - RÈGLES STRICTES]:
${paymentRules}${confirmationInstructions}

MÉTHODES DISPONIBLES:
${methodsText}

${isFrench ? 'FORMAT: Donne uniquement le username quand on demande.' : 'FORMAT: Give only the username when asked.'}`

  return {
    contexts: {
      ...state.contexts,
      payment: paymentContext
    },
    metadata: {
      ...metadata,
      paymentClassification: classification,
      paymentClassifierSource: shouldRunClassifier ? 'llm-gated' : 'deterministic-gate',
      llmCallsThisTurn:
        ((metadata.llmCallsThisTurn as number) || 0) + (shouldRunClassifier ? 1 : 0)
    }
  }
}
