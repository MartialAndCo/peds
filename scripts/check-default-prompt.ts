#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
    console.log('🔍 VÉRIFICATION DU PROMPT PAR DÉFAUT\n')
    
    const defaultPrompt = await prisma.prompt.findFirst({ 
        where: { isActive: true } 
    }) || await prisma.prompt.findFirst()
    
    if (!defaultPrompt) {
        console.log('❌ AUCUN PROMPT TROUVÉ !')
        return
    }
    
    console.log(`🆔 ID: ${defaultPrompt.id}`)
    console.log(`📛 Nom: ${defaultPrompt.name}`)
    console.log(`🤖 Modèle: ${defaultPrompt.model}`)
    console.log(`🌡️  Température: ${defaultPrompt.temperature}`)
    console.log(`📊 Max Tokens: ${defaultPrompt.max_tokens}`)
    console.log(`✅ Actif: ${defaultPrompt.isActive}`)
    
    console.log('\n' + '═'.repeat(80))
    console.log('📝 SYSTEM PROMPT COMPLET:')
    console.log('═'.repeat(80))
    console.log(defaultPrompt.system_prompt)
    
    // Chercher des références suspectes
    console.log('\n' + '═'.repeat(80))
    console.log('🔍 ANALYSE:')
    
    const prompt = defaultPrompt.system_prompt?.toLowerCase() || ''
    
    if (prompt.includes('jsuis') || prompt.includes('je suis là')) {
        console.log('⚠️  CONTIENT "jsuis" ou "je suis là" !')
    }
    
    if (prompt.length < 100) {
        console.log('⚠️  PROMPT TRÈS COURT ! (' + prompt.length + ' caractères)')
    }
    
    if (!prompt.includes('personality') && !prompt.includes('persona')) {
        console.log('⚠️  PAS DE PERSONNALITÉ DÉFINIE')
    }
    
    // Vérifier les conversations qui utilisent ce prompt
    const convCount = await prisma.conversation.count({
        where: { promptId: defaultPrompt.id }
    })
    console.log(`\n💬 ${convCount} conversations utilisent ce prompt`)
    
    await prisma.$disconnect()
}

check().catch(console.error)
