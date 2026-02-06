// Script pour vérifier les paymentRules en DB
import { prisma } from '../lib/prisma'

async function main() {
  console.log('🔍 Vérification des paymentRules en DB...\n')
  
  const profiles = await prisma.agentProfile.findMany({
    include: {
      agent: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
  
  for (const profile of profiles) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Agent: ${profile.agent?.name || 'N/A'} (${profile.agentId})`)
    console.log(`Locale: ${profile.locale || 'non défini'}`)
    console.log(`${'='.repeat(60)}`)
    
    if (!profile.paymentRules) {
      console.log('❌ paymentRules: NULL / vide')
      continue
    }
    
    const rules = profile.paymentRules
    console.log('📝 paymentRules trouvées:')
    console.log('-'.repeat(40))
    console.log(rules)
    console.log('-'.repeat(40))
    
    // Détection de doublons et problèmes
    const issues = []
    
    // Vérifie les répétitions de phrases
    const lines = rules.split('\n').filter(l => l.trim().length > 10)
    const seen = new Set<string>()
    for (const line of lines) {
      const normalized = line.toLowerCase().trim()
      if (seen.has(normalized)) {
        issues.push(`🚨 DOUBLON: "${line.substring(0, 50)}..."`)
      }
      seen.add(normalized)
    }
    
    // Vérifie les contradictions
    if (rules.toLowerCase().includes('envoyé') && rules.toLowerCase().includes('attends')) {
      const envoyéCount = (rules.match(/envoyé/gi) || []).length
      const attendsCount = (rules.match(/attends/gi) || []).length
      if (envoyéCount > 0 && attendsCount > 0) {
        issues.push(`⚠️ CONFLIT: Instructions pour "envoyé" ET "attends" présentes - risque de confusion`)
      }
    }
    
    // Vérifie si les mots magiques sont présents
    const hasConfirmationRule = 
      rules.toLowerCase().includes('déjà envoyé') ||
      rules.toLowerCase().includes('already sent') ||
      rules.toLowerCase().includes('confirmation') ||
      rules.toLowerCase().includes('merci') && rules.toLowerCase().includes('reçu')
    
    if (!hasConfirmationRule) {
      issues.push(`❌ MANQUANT: Pas d'instruction pour réagir quand l'utilisateur confirme avoir déjà envoyé`)
    }
    
    // Vérifie [PAIEMENT_REÇU] / [PAYMENT_RECEIVED]
    if (!rules.includes('[') || !rules.includes(']')) {
      issues.push(`❌ MANQUANT: Pas de tag [PAIEMENT_REÇU] ou [PAYMENT_RECEIVED] dans les règles`)
    }
    
    // Vérifie les doubles espaces ou sauts de ligne excessifs
    if (rules.includes('\n\n\n')) {
      issues.push(`⚠️ FORMAT: Sauts de ligne excessifs (3+)`)
    }
    
    if (issues.length > 0) {
      console.log('\n🔴 PROBLÈMES DÉTECTÉS:')
      issues.forEach(i => console.log(`   ${i}`))
    } else {
      console.log('\n✅ Règles OK - pas de doublons détectés')
    }
    
    // Stats
    console.log(`\n📊 Stats:`)
    console.log(`   - Longueur: ${rules.length} caractères`)
    console.log(`   - Lignes: ${rules.split('\n').length}`)
    console.log(`   - Mots: ${rules.split(/\s+/).length}`)
  }
  
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
