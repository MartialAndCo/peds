import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncAnaisWithLena() {
  console.log('🔄 Synchronisation Anaïs avec Lena...\n')

  // Get agents with profiles
  const lena = await prisma.agent.findFirst({
    where: { name: 'Lena' },
    include: { profile: true }
  })

  const anais = await prisma.agent.findFirst({
    where: { name: 'Anaïs' },
    include: { profile: true }
  })

  if (!lena || !anais) {
    console.log('❌ Agent not found')
    await prisma.$disconnect()
    return
  }

  if (!lena.profile || !anais.profile) {
    console.log('❌ Agent profile not found')
    await prisma.$disconnect()
    return
  }

  console.log('✅ Agents trouvés')
  console.log(`Lena ID: ${lena.id}`)
  console.log(`Anaïs ID: ${anais.id}\n`)

  // Compare templates
  console.log('📋 Comparaison des templates...\n')

  const differences: Array<{ field: string, lenaLength: number, anaisLength: number, different: boolean }> = []

  const templateFields = [
    'identityTemplate',
    'contextTemplate',
    'missionTemplate',
    'phaseConnectionTemplate',
    'phaseVulnerabilityTemplate',
    'phaseCrisisTemplate',
    'phaseMoneypotTemplate',
    'paymentRules',
    'safetyRules',
    'styleRules'
  ]

  for (const field of templateFields) {
    const lenaValue = lena.profile[field] as string | null
    const anaisValue = anais.profile[field] as string | null

    const lenaLength = lenaValue?.length || 0
    const anaisLength = anaisValue?.length || 0
    const different = lenaValue !== anaisValue

    differences.push({
      field,
      lenaLength,
      anaisLength,
      different
    })

    const status = different ? '🔄' : '✅'
    console.log(`${status} ${field}:`)
    console.log(`   Lena:  ${lenaLength} chars`)
    console.log(`   Anaïs: ${anaisLength} chars`)
    if (different) {
      console.log(`   → Différence détectée`)
    }
    console.log('')
  }

  // Count differences
  const differentCount = differences.filter(d => d.different).length
  console.log(`\n📊 Résumé: ${differentCount} différence(s) détectée(s) sur ${templateFields.length} champs\n`)

  if (differentCount === 0) {
    console.log('✅ Anaïs est déjà synchronisée avec Lena!')
    await prisma.$disconnect()
    return
  }

  // Sync differences
  console.log('🔄 Synchronisation en cours...\n')

  const updateData: any = {}
  let syncedCount = 0

  for (const diff of differences) {
    if (diff.different) {
      const lenaValue = lena.profile[diff.field]
      if (lenaValue !== null && lenaValue !== undefined) {
        updateData[diff.field] = lenaValue
        syncedCount++
        console.log(`✅ ${diff.field} synchronisé (${diff.lenaLength} chars)`)
      }
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.agentProfile.update({
      where: { agentId: anais.id },
      data: updateData
    })
    console.log(`\n✅ ${syncedCount} champ(s) synchronisé(s) avec succès!`)
  } else {
    console.log('\n⚠️ Aucune mise à jour à effectuer')
  }

  await prisma.$disconnect()
}

syncAnaisWithLena().catch(console.error)
