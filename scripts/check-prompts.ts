#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPrompts() {
    console.log('🔍 VÉRIFICATION DES PROMPTS\n')
    
    // 1. Prompts des agents concernés
    const agents = await prisma.agent.findMany({
        where: { name: { in: ['Lena', 'Anaïs'] } },
        include: {
            agentPrompts: {
                include: { prompt: true }
            }
        }
    })
    
    for (const agent of agents) {
        console.log(`\n🤖 Agent: ${agent.name} (${agent.id})`)
        console.log('═'.repeat(80))
        
        for (const ap of agent.agentPrompts) {
            console.log(`\n📋 Prompt type: ${ap.type}`)
            console.log(`Modèle: ${ap.prompt.model}`)
            console.log(`\n📝 SYSTÈME PROMPT (début):`)
            console.log(ap.prompt.system_prompt?.substring(0, 500) + '...')
            
            // Chercher des références suspectes
            if (ap.prompt.system_prompt?.toLowerCase().includes('jsuis')) {
                console.log('\n⚠️  CONTIENT "jsuis" !')
            }
            if (ap.prompt.system_prompt?.toLowerCase().includes('je suis là')) {
                console.log('\n⚠️  CONTIENT "je suis là" !')
            }
        }
    }
    
    // 2. Vérifier s'il y a des réponses pré-enregistrées
    console.log('\n\n🔍 RÉPONSES AUTOMATIQUES / TEMPLATES\n')
    console.log('═'.repeat(80))
    
    const settings = await prisma.setting.findMany({
        where: {
            OR: [
                { key: { contains: 'msg_' } },
                { key: { contains: 'auto_' } },
                { key: { contains: 'template' } },
                { value: { contains: 'jsuis' } }
            ]
        }
    })
    
    for (const s of settings) {
        console.log(`${s.key}: ${s.value?.substring(0, 100)}`)
    }
    
    await prisma.$disconnect()
}

checkPrompts().catch(console.error)
