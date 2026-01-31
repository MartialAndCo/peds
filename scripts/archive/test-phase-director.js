const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * TEST E2E: Phase Templates & Director Integration
 * - Vérifie que chaque phase a son template
 * - Explique comment Director doit injecter les phases
 */

async function testPhaseTemplates() {
    console.log('=== TEST: PHASE TEMPLATES & DIRECTOR ===\n')

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    })

    if (!anais) {
        console.log('❌ Agent non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}`)
    console.log(`Âge: ${anais.profile?.baseAge}\n`)

    // Vérifier templates
    const phases = {
        CONNECTION: anais.profile?.phaseConnectionTemplate,
        VULNERABILITY: anais.profile?.phaseVulnerabilityTemplate,
        CRISIS: anais.profile?.phaseCrisisTemplate,
        MONEYPOT: anais.profile?.phaseMoneypotTemplate
    }

    console.log('📋 Phase Templates:')
    Object.entries(phases).forEach(([phase, template]) => {
        if (template) {
            console.log(`  ✅ ${phase}: ${template.length} chars`)
        } else {
            console.log(`  ❌ ${phase}: MANQUANT`)
        }
    })

    // Check context template
    const hasPhaseVariable = anais.profile?.contextTemplate?.includes('{{PHASE}}')
    console.log(`\n📋 Context Template:`)
    console.log(`  Contient {{PHASE}} variable: ${hasPhaseVariable ? '✅' : '❌'}`)

    console.log('\n🔍 Comment fonctionne le Director:')
    console.log('1. Director.determinePhase() calcule la phase selon:')
    console.log('   - Nombre de jours actifs')
    console.log('   - Trust score')
    console.log('   - Historique paiements')
    console.log('')
    console.log('2. Director.buildSystemPrompt() construit le prompt final:')
    console.log('   - Charge identityTemplate')
    console.log('   - Charge contextTemplate (avec {{PHASE}} = phase actuelle)')
    console.log('   - Charge missionTemplate')
    console.log('   - Charge le phase template correspondant (CONNECTION/VULNERABILITY/etc.)')
    console.log('   - Charge styleRules')
    console.log('   - Charge safetyRules')
    console.log('   - Charge paymentRules')
    console.log('')
    console.log('3. Le prompt complet est envoyé à l\'IA')
    console.log('')
    console.log('⚠️  IMPORTANT:')
    console.log('   Le Director injecte TOUTES les règles + la phase active')
    console.log('   Ce n\'est PAS le Director qui choisit quelles règles injecter')
    console.log('   TOUTES les règles sont TOUJOURS présentes')
    console.log('   Seule la PHASE change dynamiquement')

    console.log('\n🔍 Tags que l\'IA doit comprendre:')
    console.log('  [VOICE] → Envoyer note vocale')
    console.log('  [IMAGE:type] → Envoyer photo (type: selfie, outfit, etc.)')
    console.log('  [VIDEO] → Envoyer vidéo')
    console.log('  [PAYMENT_RECEIVED] → Confirmer réception paiement')

    console.log('\n📝 Test manuel requis:')
    console.log('1. Vérifier que Director.determinePhase() retourne la bonne phase')
    console.log('2. Vérifier que buildSystemPrompt() inclut le bon template de phase')
    console.log('3. Tester conversation à différentes phases')
    console.log('4. Vérifier que comportement change selon phase')
}

testPhaseTemplates()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
