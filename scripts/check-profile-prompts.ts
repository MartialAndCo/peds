#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
    console.log('🔍 VÉRIFICATION DES PROFILS AGENTS\n')
    
    const profiles = await prisma.agentProfile.findMany({
        where: {
            agent: { name: { in: ['Lena', 'Anaïs'] } }
        },
        include: { agent: true }
    })
    
    for (const profile of profiles) {
        console.log('═'.repeat(80))
        console.log(`🤖 ${profile.agent.name} (AgentProfile ID: ${profile.id})`)
        console.log('═'.repeat(80))
        
        console.log('\n📋 BIO:')
        console.log(profile.bio?.substring(0, 200) || '❌ VIDE')
        
        console.log('\n🎭 PERSONALITY:')
        console.log(profile.personality?.substring(0, 200) || '❌ VIDE')
        
        console.log('\n✨ STYLE:')
        console.log(profile.style?.substring(0, 200) || '❌ VIDE')
        
        console.log('\n🔗 PHASE TEMPLATES:')
        console.log(`   Connection: ${profile.phaseConnectionTemplate?.substring(0, 100) || '❌ VIDE'}`)
        console.log(`   Vulnerability: ${profile.phaseVulnerabilityTemplate?.substring(0, 100) || '❌ VIDE'}`)
        console.log(`   Crisis: ${profile.phaseCrisisTemplate?.substring(0, 100) || '❌ VIDE'}`)
        console.log(`   Moneypot: ${profile.phaseMoneypotTemplate?.substring(0, 100) || '❌ VIDE'}`)
    }
    
    // Vérifier comment les conversations sont liées
    console.log('\n\n' + '═'.repeat(80))
    console.log('🔗 LIEN CONVERSATION → PROMPT')
    console.log('═'.repeat(80))
    
    const conversations = await prisma.conversation.findMany({
        where: {
            agent: { name: { in: ['Lena', 'Anaïs'] } }
        },
        include: {
            agent: { include: { profile: true } },
            prompt: true
        },
        take: 5
    })
    
    for (const conv of conversations) {
        console.log(`\nConversation ${conv.id}:`)
        console.log(`  Agent: ${conv.agent?.name}`)
        console.log(`  Agent a un profil: ${conv.agent?.profile ? 'OUI' : 'NON'}`)
        console.log(`  Prompt lié (ancien système): ${conv.prompt?.name || 'AUCUN'}`)
        console.log(`  Prompt.system_prompt: ${conv.prompt?.system_prompt?.substring(0, 50) || 'VIDE'}...`)
    }
    
    await prisma.$disconnect()
}

check().catch(console.error)
