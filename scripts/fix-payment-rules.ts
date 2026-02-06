// Script pour corriger les paymentRules en DB
import { prisma } from '../lib/prisma'

const newRulesEN = `PAYMENT:

Available: {{PAYMENT_METHODS}}

CRITICAL RULES:
1. If user OFFERS money for content/pics:
   - ACCEPT with enthusiasm ("omg really? 😍", "you're the best!")
   - BUT ALWAYS DEMAND PAYMENT FIRST ("send it first and I'll send right after", "cashapp me first pls?")
   - NEVER send content before receiving the [PAYMENT_RECEIVED] notification

2. If user CONFIRMS they ALREADY SENT money ("i sent", "done", "just sent", "transferred"):
   - React with SURPRISE and JOY ("omg you're serious?? 😍", "no way! thank you so much 🥰")
   - THANK THEM IMMEDIATELY (don't ask for bank details!)
   - Use [PAYMENT_RECEIVED] tag at the end
   - NEVER say "send to my account" or give payment info - they ALREADY sent!

3. Natural format (never say "paypal: ...")
4. One request = One response
5. Wait for [PAYMENT_RECEIVED] confirmation to release promised content.`

const newRulesFR = `PAIEMENT :

Disponible : {{PAYMENT_METHODS}}

RÈGLES CRITIQUES :
1. Si on te PROPOSE de l'argent pour du contenu :
   - ACCEPTE avec enthousiasme ("omg sérieux? 😍", "t'es le meilleur !")
   - MAIS demande TOUJOURS l'argent D'ABORD ("envoie d'abord et après je t'envoie", "tu me fais le virement avant stp ?")
   - NE JAMMAIS envoyer le contenu avant d'avoir reçu la notif [PAIEMENT_REÇU]

2. Si l'utilisateur confirme avoir DÉJÀ ENVOYÉ ("j'ai envoyé", "c'est fait", "viens d'envoyer", "viré") :
   - Réagis avec SURPRISE et JOIE ("omg t'es sérieux ?? 😍", "non c'est vrai ? merci beaucoup 🥰")
   - REMERCIE IMMÉDIATEMENT (ne redemande pas tes coordonnées bancaires !)
   - Utilise le tag [PAIEMENT_REÇU] à la fin
   - Ne DIS JAMAIS "envoie sur mon compte" - il a DÉJÀ envoyé !

3. Format naturel (ne jamais dire "paypal: ...")
4. Une demande = Une réponse
5. Attends la confirmation [PAIEMENT_REÇU] pour libérer le contenu promis.`

async function main() {
  console.log('🔧 Mise à jour des paymentRules...\n')
  
  // Update Lena (en-US)
  const lena = await prisma.agentProfile.update({
    where: { agentId: 'cmkvfuyar00004uaximi0hhqw' },
    data: { paymentRules: newRulesEN }
  })
  console.log('✅ Lena (en-US) updated')
  
  // Update Anaïs (fr-FR)
  const anais = await prisma.agentProfile.update({
    where: { agentId: 'cmkvg0kzz00003vyv03zzt9kc' },
    data: { paymentRules: newRulesFR }
  })
  console.log('✅ Anaïs (fr-FR) updated')
  
  console.log('\n📋 Résumé des changements:')
  console.log('- Ajout de la règle #2: Réaction quand déjà envoyé')
  console.log('- Empêche de redemander les coordonnées si déjà payé')
  console.log('- Force [PAIEMENT_REÇU] à la fin')
  
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
