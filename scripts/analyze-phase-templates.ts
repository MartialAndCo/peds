import { prisma } from '@/lib/prisma'

async function analyzePhaseTemplates() {
  const agents = await prisma.agent.findMany({
    include: { profile: true }
  })

  console.log('🔍 ANALYSE DES PROMPTS DE PHASES EN DB\n')
  console.log('=' .repeat(80))

  for (const agent of agents) {
    if (!agent.profile) {
      console.log(`\n❌ Agent ${agent.name}: PAS DE PROFIL`)
      continue
    }

    console.log(`\n📱 Agent: ${agent.name} (ID: ${agent.id})`)
    console.log('-' .repeat(80))

    const templates = {
      CONNECTION: agent.profile.phaseConnectionTemplate,
      VULNERABILITY: agent.profile.phaseVulnerabilityTemplate,
      CRISIS: agent.profile.phaseCrisisTemplate,
      MONEYPOT: agent.profile.phaseMoneypotTemplate
    }

    for (const [phase, template] of Object.entries(templates)) {
      console.log(`\n  📌 PHASE: ${phase}`)
      
      if (!template) {
        console.log(`     ❌ TEMPLATE VIDE (NULL)`)
        continue
      }

      const length = template.length
      const lines = template.split('\n').length
      
      // Analyse du contenu
      const hasObjective = /objectif|objective|goal/i.test(template)
      const hasRestrictions = /interdiction|forbidden|ban|🚫|❌/i.test(template)
      const hasExamples = /exemple|example/i.test(template)
      const hasAntiRepetition = /répéti|repetition|déjà|already|varie/i.test(template)
      const hasActiveListening = /écoute|listen|réagir|react/i.test(template)
      const hasVariety = /varie|variety|change|différent|altern/i.test(template)
      const hasShortMessages = /3-5|3 à 5|court|short|ultra|bref/i.test(template)
      
      console.log(`     📏 Longueur: ${length} caractères, ${lines} lignes`)
      console.log(`     ✅ Objectif défini: ${hasObjective ? 'OUI' : 'NON'}`)
      console.log(`     ✅ Interdictions: ${hasRestrictions ? 'OUI' : 'NON'}`)
      console.log(`     ✅ Exemples: ${hasExamples ? 'OUI' : 'NON'}`)
      console.log(`     ✅ Messages courts: ${hasShortMessages ? 'OUI' : 'NON'}`)
      console.log(`     ⚠️  Anti-répétition: ${hasAntiRepetition ? 'OUI' : 'NON'}`)
      console.log(`     ⚠️  Écoute active: ${hasActiveListening ? 'OUI' : 'NON'}`)
      console.log(`     ⚠️  Variété: ${hasVariety ? 'OUI' : 'NON'}`)

      // Vérifier s'il y a des "thèmes" ou "sujets" listés
      const hasThemesList = /thème|theme|sujet|topic|liste/i.test(template)
      console.log(`     ⚠️  Liste de thèmes: ${hasThemesList ? 'OUI' : 'NON'}`)

      // Extraire les mots-clés problématiques fréquents
      const problematicPatterns = [
        { pattern: /maman.*facture/i, name: 'maman+factures' },
        { pattern: /stresse.*facture/i, name: 'stress+factures' },
        { pattern: /bloquée.*chez/i, name: 'bloquée chez moi' },
        { pattern: /toujours.*même/i, name: 'toujours le même' },
        { pattern: /coincée.*maison/i, name: 'coincée à la maison' }
      ]
      
      let hasProblematicPattern = false
      for (const { pattern, name } of problematicPatterns) {
        if (pattern.test(template)) {
          console.log(`     🔴 ALERTE: Pattern problématique: '${name}'`)
          hasProblematicPattern = true
        }
      }
      
      if (!hasProblematicPattern) {
        console.log(`     ✅ Pas de pattern problématique détecté`)
      }

      // Preview des 300 premiers caractères
      const preview = template.substring(0, 300).replace(/\n/g, ' ')
      console.log(`     📝 Aperçu:`)
      console.log(`        ${preview}...`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 RÉSUMÉ DES PROBLÈMES IDENTIFIÉS:\n')
  
  let totalTemplates = 0
  let missingAntiRepetition = 0
  let missingActiveListening = 0
  let missingVariety = 0
  
  for (const agent of agents) {
    if (!agent.profile) continue
    
    const templates = [
      agent.profile.phaseConnectionTemplate,
      agent.profile.phaseVulnerabilityTemplate,
      agent.profile.phaseCrisisTemplate,
      agent.profile.phaseMoneypotTemplate
    ]
    
    for (const template of templates) {
      if (!template) continue
      totalTemplates++
      
      if (!/répéti|repetition|déjà|already|varie/i.test(template)) missingAntiRepetition++
      if (!/écoute|listen|réagir|react/i.test(template)) missingActiveListening++
      if (!/varie|variety|change|différent|altern/i.test(template)) missingVariety++
    }
  }
  
  console.log(`Templates analysés: ${totalTemplates}`)
  console.log(`- Sans règles anti-répétition: ${missingAntiRepetition}/${totalTemplates} (${Math.round(missingAntiRepetition/totalTemplates*100)}%)`)
  console.log(`- Sans écoute active: ${missingActiveListening}/${totalTemplates} (${Math.round(missingActiveListening/totalTemplates*100)}%)`)
  console.log(`- Sans variété imposée: ${missingVariety}/${totalTemplates} (${Math.round(missingVariety/totalTemplates*100)}%)`)
  
  console.log('\n🔧 RECOMMANDATIONS:\n')
  console.log('1. Ajouter des règles ANTI-RÉPÉTITION explicites dans chaque phase')
  console.log('2. Ajouter des instructions d\'ÉCOUTE ACTIVE (réagir avant de parler)')
  console.log('3. Ajouter une LISTE DE THÈMES à varier (famille, école, amis, etc.)')
  console.log('4. Vérifier que VULNERABILITY n\'encourage pas à toujours dire "maman/factures"')
}

analyzePhaseTemplates().then(() => process.exit(0))
