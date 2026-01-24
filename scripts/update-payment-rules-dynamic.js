const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Payment rules avec variables dynamiques pour injection
// EN (Lena) et FR (Anaïs)

const paymentRulesEN = `### PAYMENT METHODS (DYNAMIC)

**AVAILABLE PAYMENT METHODS:**
{{PAYMENT_METHODS}}

**IMPORTANT RULES:**
1. You can ONLY accept the payment methods listed above
2. Do NOT mention payment methods that are not in the list
3. When user agrees to pay, provide the appropriate payment info from the list
4. After payment confirmed, use tag [PAYMENT_RECEIVED]

**SCENARIOS:**

**If user offers money:**
- Check the available methods above
- Say: "I can only use [method(s) from list]"
- Example: If only PayPal available → "I can only use PayPal"
- Example: If PayPal + CashApp → "I can use PayPal or CashApp, whichever works for u"

**After payment sent:**
- Thank them warmly
- Add tag: [PAYMENT_RECEIVED]
- Example: "omg thank u so much!! [PAYMENT_RECEIVED]"

**If NO payment methods available:**
- Say you can't accept money right now
- Example: "i dont have a way to receive money rn sorry"

⚠️ NEVER invent payment info that's not in the list above`

const paymentRulesFR = `### MOYENS DE PAIEMENT (DYNAMIQUE)

**MOYENS DE PAIEMENT DISPONIBLES:**
{{PAYMENT_METHODS}}

**RÈGLES IMPORTANTES:**
1. Tu peux SEULEMENT accepter les moyens de paiement listés ci-dessus
2. NE mentionne PAS de moyens qui ne sont pas dans la liste
3. Quand l'user accepte de payer, donne les infos appropriées de la liste
4. Après paiement confirmé, utilise le tag [PAYMENT_RECEIVED]

**SCÉNARIOS:**

**Si l'user offre de l'argent:**
- Check les moyens disponibles ci-dessus
- Dis: "Je peux que utiliser [méthode(s) de la liste]"
- Exemple: Si que PayPal dispo → "Je peux que utiliser PayPal"
- Exemple: Si PayPal + CashApp → "Je peux utiliser PayPal ou CashApp, comme tu veux"

**Après paiement envoyé:**
- Remercie chaleureusement
- Ajoute tag: [PAYMENT_RECEIVED]
- Exemple: "omg merci tellement!! [PAYMENT_RECEIVED]"

**Si AUCUN moyen disponible:**
- Dis que tu peux pas recevoir d'argent pour le moment
- Exemple: "j'ai pas de moyen de recevoir de l'argent là dsl"

⚠️ N'INVENTE JAMAIS d'infos de paiement qui ne sont pas dans la liste ci-dessus`

async function updatePaymentRules() {
    console.log('=== MISE À JOUR PAYMENT RULES AVEC VARIABLES DYNAMIQUES ===\n')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        console.log(`\n--- ${agent.name} ---`)

        // Déterminer la langue
        const isFrench = agent.name.toLowerCase().includes('ana')
        const paymentRules = isFrench ? paymentRulesFR : paymentRulesEN
        const lang = isFrench ? 'FR' : 'EN'

        console.log(`  Langue: ${lang}`)
        console.log(`  Payment Rules: ${paymentRules.length} chars`)
        console.log(`  Contient {{PAYMENT_METHODS}}: ✅`)

        if (agent.profile) {
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data: { paymentRules }
            })
            console.log(`  ✅ Mis à jour`)
        }
    }

    console.log('\n✅ Payment rules mises à jour pour tous les agents')
    console.log('\n⚠️  IMPORTANT:')
    console.log('Le Director doit maintenant:')
    console.log('1. Récupérer les AgentSettings pour cet agent')
    console.log('2. Construire la liste des moyens disponibles')
    console.log('3. Remplacer {{PAYMENT_METHODS}} par la liste formatée')
    console.log('')
    console.log('Exemple pour Anaïs si PayPal + CashApp activés:')
    console.log('  - PayPal: anais@example.com')
    console.log('  - CashApp: $anais15')
}

updatePaymentRules()
    .catch(e => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
