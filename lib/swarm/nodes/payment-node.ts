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
  
  const paymentContext = `[PAIEMENT - RÈGLES STRICTES]:
${profile?.paymentRules || (isFrench ? 'Si on propose de payer → ACCEPTE avec enthousiasme. Attends confirmation avant [PAYMENT_RECEIVED].' : 'If offered money → ACCEPT enthusiastically. Wait confirmation before [PAYMENT_RECEIVED].')}

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
