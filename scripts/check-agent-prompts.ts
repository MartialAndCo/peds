#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
    console.log('🔍 VÉRIFICATION PROMPTS AGENTS\n')
    
    const agents = await prisma.agent.findMany({
        where: { name: { in: ['Lena', 'Anaïs'] } },
        include: {
            profile: true,
            agentPrompts: {
                include: { prompt: true }
            },
            settings: true
        }
    })
    
    for (const agent of agents) {
        console.log('\n' + '═'.repeat(80))
        console.log(`🤖 ${agent.name} (ID: ${agent.id})`)
        console.log('═'.repeat(80))
        
        // 1. Profil
        if (agent.profile) {
            console.log('\n📋 PROFIL:')
            console.log(`   Bio: ${agent.profile.bio?.substring(0, 100)}...`)
            console.log(`   Personality: ${agent.profile.personality?.substring(0, 100)}...`)
            console.log(`   Style: ${agent.profile.style?.substring(0, 100)}...`)
        }
        
        // 2. Prompts
        console.log('\n📝 PROMPTS:')
        if (agent.agentPrompts.length === 0) {
            console.log('   ⚠️  AUCUN PROMPT CONFIGURÉ !')
        } else {
            for (const ap of agent.agentPrompts) {
                console.log(`\n   [${ap.type}]`)
                console.log(`   ${ap.prompt.system_prompt?.substring(0, 200)}...`)
            }
        }
        
        // 3. Settings
        console.log('\n⚙️  SETTINGS:')
        for (const s of agent.settings) {
            console.log(`   ${s.key}: ${s.value?.substring(0, 50)}`)
        }
        
        // 4. Conversations actives
        const activeConvs = await prisma.conversation.count({
            where: { agentId: agent.id, status: 'active' }
        })
        console.log(`\n💬 Conversations actives: ${activeConvs}`)
    }
    
    // 5. Vérifier la table Prompt globale
    console.log('\n\n' + '═'.repeat(80))
    console.log('📝 PROMPTS GLOBAUX (table Prompt)')
    console.log('═'.repeat(80))
    
    const prompts = await prisma.prompt.findMany()
    for (const p of prompts) {
        console.log(`\n🆔 ${p.id} - ${p.name} ${p.isActive ? '(ACTIVE)' : ''}`)
        console.log(`   Modèle: ${p.model}`)
        const hasJsuis = p.system_prompt?.toLowerCase().includes('jsuis') || 
                         p.system_prompt?.toLowerCase().includes('je suis là')
        if (hasJsuis) {
            console.log('   ⚠️  CONTIENT "jsuis" ou "je suis là" !')
        }
    }
    
    await prisma.$disconnect()
}

check().catch(console.error)
