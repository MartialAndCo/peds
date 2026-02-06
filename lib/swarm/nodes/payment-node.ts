import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';
import { settingsService } from '@/lib/settings-cache';

export async function paymentNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] paymentNode: Analyse contexte paiement');
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId },
    select: { 
      paymentRules: true, 
      locale: true,
      bankAccountNumber: true,
      bankRoutingNumber: true
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
  
  // Détecter si l'utilisateur confirme déjà avoir envoyé de l'argent
  const userMsg = state.userMessage.toLowerCase();
  
  // Mots-clés d'action (avoir envoyé)
  const sentActionWords = ['sent', 'envoyé', 'envoye', 'payé', 'paye', 'paid', 'done', 
    'transfer', 'transferred', 'viré', 'vire', 'just sent', 'already sent', 
    "c'est fait", "cest fait", "check your", "regarde ton", "regardez"];
  
  // Mots-clés contexte (argent/paiement)
  const moneyContextWords = ['money', 'argent', 'payment', 'paiement', 'paypal', 
    'cashapp', 'venmo', 'zelle', 'transfer', 'virement', 'bank', 'compte',
    '$', '€', 'dollar', 'euro', 'bucks', '10k', '10 000', '10000', '10,000',
    'sent you', 'sent the', 'envoyé le', 'envoyé l'];
  
  const hasSentAction = sentActionWords.some(word => userMsg.includes(word));
  const hasMoneyContext = moneyContextWords.some(word => userMsg.includes(word));
  
  // Détection PLUS permissive: soit action explicite, soit confirmation claire
  const isPaymentConfirmation = hasSentAction && (hasMoneyContext || userMsg.includes('check') || userMsg.includes('done'));
  
  const confirmationInstructions = isPaymentConfirmation 
    ? (isFrench 
        ? `\n\n⚠️ UTILISATEUR CONFIRME AVOIR DÉJÀ ENVOYÉ L'ARGENT:\n→ Réagis avec SURPRISE et JOIE (pas "envoie sur mon compte")\n→ Remercie immédiatement\n→ Utilise [PAIEMENT_REÇU] à la fin\n→ EXEMPLE: "omg t'es sérieux ?? merci beaucoup 🥰 [PAIEMENT_REÇU]"`
        : `\n\n⚠️ USER CONFIRMS THEY ALREADY SENT MONEY:\n→ React with SURPRISE and JOY (not "send to my account")\n→ Thank them immediately\n→ Use [PAYMENT_RECEIVED] at the end\n→ EXAMPLE: "omg are you serious?? thank you so much 🥰 [PAYMENT_RECEIVED]"`)
    : '';
  
  const paymentContext = `[PAIEMENT - RÈGLES STRICTES]:
${profile?.paymentRules || (isFrench ? 'Si on propose de payer → ACCEPTE avec enthousiasme. Attends confirmation avant [PAIEMENT_REÇU].' : 'If offered money → ACCEPT enthusiastically. Wait confirmation before [PAYMENT_RECEIVED].')}${confirmationInstructions}

MÉTHODES DISPONIBLES:
${methodsText}

${isFrench ? 'FORMAT: Donne UNIQUEMENT le username quand on demande. Pas "PayPal: ..." juste "monusername"' : 'FORMAT: Give ONLY username when asked. Not "PayPal: ..." just "myusername"'}`;
  
  return {
    contexts: {
      ...state.contexts,
      payment: paymentContext
    }
  };
}
