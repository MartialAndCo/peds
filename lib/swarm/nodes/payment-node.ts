import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';
import { settingsService } from '@/lib/settings-cache';
import { classifyPaymentIntent } from '@/lib/services/payment-intent-classifier';

export async function paymentNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] paymentNode: Analyse contexte paiement');
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId },
    select: { 
      paymentRules: true, 
      locale: true,
      bankAccountNumber: true,
      bankRoutingNumber: true,
      baseAge: true
    }
  });
  
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');
  
  // Récupérer les settings de paiement
  const settings = await settingsService.getSettings();
  
  // Construire la liste des méthodes de paiement disponibles
  const methods: string[] = [];
  
  if (settings['payment_paypal_enabled'] === 'true' && settings['payment_paypal_username']) {
    methods.push(isFrench 
      ? `PayPal: ${settings['payment_paypal_username']}`
      : `PayPal: ${settings['payment_paypal_username']}`);
  }
  
  if (settings['payment_venmo_enabled'] === 'true' && settings['payment_venmo_username']) {
    methods.push(`Venmo: ${settings['payment_venmo_username']}`);
  }
  
  if (settings['payment_cashapp_enabled'] === 'true' && settings['payment_cashapp_username']) {
    methods.push(`CashApp: ${settings['payment_cashapp_username']}`);
  }
  
  if (settings['payment_zelle_enabled'] === 'true' && settings['payment_zelle_username']) {
    methods.push(`Zelle: ${settings['payment_zelle_username']}`);
  }
  
  if (settings['payment_bank_enabled'] === 'true' && profile?.bankAccountNumber) {
    methods.push(isFrench
      ? `Virement: Account ${profile.bankAccountNumber}, Routing ${profile.bankRoutingNumber}`
      : `Bank: Account ${profile.bankAccountNumber}, Routing ${profile.bankRoutingNumber}`);
  }
  
  // Customs
  try {
    if (settings['payment_custom_methods']) {
      const customs = JSON.parse(settings['payment_custom_methods']);
      customs.forEach((c: any) => {
        if (c.name && c.value) methods.push(`${c.name}: ${c.value}`);
      });
    }
  } catch (e) {
    console.error('Failed to parse custom payment methods', e);
  }
  
  const methodsText = methods.length > 0 
    ? methods.join('\n')
    : (isFrench ? '(Aucune méthode configurée)' : '(No payment methods configured)');
  
  // Use LLM classifier for intent detection
  let classification;
  try {
    // Build history from state if available
    const history = state.messages?.slice(-3).map((m: any) => ({
      role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content as string
    })) || [];
    
    classification = await classifyPaymentIntent(
      state.userMessage,
      history,
      settings.venice_api_key
    );
    
    console.log('[Swarm] paymentNode classification:', classification);
  } catch (error) {
    console.error('[Swarm] paymentNode classification error:', error);
    // Fallback to NONE on error
    classification = { intent: 'NONE', confidence: 0, reason: 'Error' };
  }
  
  // Build instructions based on LLM classification
  let confirmationInstructions = '';
  
  if (classification.intent === 'VERIFICATION') {
    // User demande si on a reçu → Pas de confirmation auto
    confirmationInstructions = isFrench 
      ? `

⚠️ L'UTILISATEUR DEMANDE SI TU AS REÇU LE PAIEMENT:
→ Réponds que tu vas vérifier
→ Utilise [VERIFY_PAYMENT] à la fin de ta réponse
→ NE PAS confirmer avoir reçu [PAIEMENT_REÇU]
→ Attends confirmation manuelle de l'admin
→ EXEMPLE: "je vais regarder ça ! 🥰 [VERIFY_PAYMENT]" ou "je check de suite ! [VERIFY_PAYMENT]"`
      : `

⚠️ USER IS ASKING IF YOU RECEIVED THE PAYMENT:
→ Say you're going to check
→ Use [VERIFY_PAYMENT] tag at the end
→ DO NOT confirm with [PAYMENT_RECEIVED]
→ Wait for manual admin validation
→ EXAMPLE: "let me check! 🥰 [VERIFY_PAYMENT]" or "i'll go look! [VERIFY_PAYMENT]"`;
  } else if (classification.intent === 'CONFIRMATION') {
    // User confirme avoir envoyé → On peut confirmer
    confirmationInstructions = isFrench 
      ? `

⚠️ UTILISATEUR CONFIRME AVOIR DÉJÀ ENVOYÉ L'ARGENT:
→ Réagis avec SURPRISE et JOIE (pas "envoie sur mon compte")
→ Remercie immédiatement
→ Utilise [PAIEMENT_REÇU] à la fin
→ EXEMPLE: "omg t'es sérieux ?? merci beaucoup 🥰 [PAIEMENT_REÇU]"`
      : `

⚠️ USER CONFIRMS THEY ALREADY SENT MONEY:
→ React with SURPRISE and JOY (not "send to my account")
→ Thank them immediately
→ Use [PAYMENT_RECEIVED] at the end
→ EXAMPLE: "omg are you serious?? thank you so much 🥰 [PAYMENT_RECEIVED]"`;
  }
  // If NONE, no special instructions - let AI respond normally
  
  // Remplacer {{PLATFORM}} et {{AGE}} si présents
  const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
  const agentAge = profile?.baseAge || 15
  const paymentRules = (profile?.paymentRules || (isFrench ? 'Si on propose de payer → ACCEPTE avec enthousiasme. Attends confirmation avant [PAIEMENT_REÇU].' : 'If offered money → ACCEPT enthusiastically. Wait confirmation before [PAYMENT_RECEIVED].'))
    .replace(/\{\{PLATFORM\}\}/g, platformName)
    .replace(/\{\{AGE\}\}/g, agentAge.toString())
  
  const paymentContext = `[PAIEMENT - RÈGLES STRICTES]:
${paymentRules}${confirmationInstructions}

MÉTHODES DISPONIBLES:
${methodsText}

${isFrench ? 'FORMAT: Donne UNIQUEMENT le username quand on demande. Pas "PayPal: ..." juste "monusername"' : 'FORMAT: Give ONLY username when asked. Not "PayPal: ..." just "myusername"'}`;
  
  return {
    contexts: {
      ...state.contexts,
      payment: paymentContext
    },
    // Store classification for potential use downstream
    metadata: {
      ...state.metadata,
      paymentClassification: classification
    }
  };
}
