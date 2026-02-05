#!/usr/bin/env tsx
/**
 * Investigation fuite de contexte entre conversations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigate() {
    console.log('🚨 INVESTIGATION FUITE DE CONTEXTE\n')
    
    // 1. Récupérer tous les messages "jsuis là" envoyés aujourd'hui après 01h00
    const oneAM = new Date('2026-02-05T01:00:00Z')
    const now = new Date()
    
    const suspiciousMessages = await prisma.message.findMany({
        where: {
            message_text: { contains: 'jsuis là' },
            timestamp: { gte: oneAM },
            sender: 'ai'
        },
        orderBy: { timestamp: 'asc' },
        include: {
            conversation: {
                include: {
                    contact: true,
                    agent: true
                }
            }
        }
    })
    
    console.log(`🔍 ${suspiciousMessages.length} messages "jsuis là" envoyés après 01h00\n`)
    console.log('═'.repeat(100))
    
    if (suspiciousMessages.length === 0) {
        console.log('Aucun message trouvé.')
        await prisma.$disconnect()
        return
    }
    
    // Grouper par conversation
    const byConversation = new Map()
    for (const msg of suspiciousMessages) {
        const convId = msg.conversationId
        if (!byConversation.has(convId)) {
            byConversation.set(convId, [])
        }
        byConversation.get(convId).push(msg)
    }
    
    console.log(`📊 Réparti sur ${byConversation.size} conversations différentes\n`)
    
    for (const [convId, messages] of byConversation.entries()) {
        const firstMsg = messages[0]
        const contact = firstMsg.conversation?.contact
        const agent = firstMsg.conversation?.agent
        
        console.log(`\n💬 Conversation ${convId}`)
        console.log(`   👤 Contact: ${contact?.name || 'Inconnu'} (${contact?.phone_whatsapp})`)
        console.log(`   🤖 Agent: ${agent?.name || 'N/A'}`)
        console.log(`   📊 ${messages.length} fois "jsuis là" envoyé`)
        
        // Afficher les horaires
        for (const m of messages) {
            console.log(`      🕐 ${m.timestamp.toISOString()}: "${m.message_text.substring(0, 50)}..."`)
        }
        
        // Vérifier s'il y a un pattern de burst (plusieurs en peu de temps)
        if (messages.length > 1) {
            const times = messages.map(m => new Date(m.timestamp).getTime())
            const intervals = []
            for (let i = 1; i < times.length; i++) {
                intervals.push((times[i] - times[i-1]) / 1000) // en secondes
            }
            console.log(`   ⏱️  Intervalles entre messages: ${intervals.map(i => Math.round(i)+'s').join(', ')}`)
            
            if (intervals.some(i => i < 60)) {
                console.log('   ⚠️  SPAM DETECTÉ - intervalles < 60s !')
            }
        }
    }
    
    // 2. Vérifier s'il y a eu des messages utilisateur avant ces réponses
    console.log('\n\n' + '═'.repeat(100))
    console.log('🔍 CONTEXTE AVANT LES RÉPONSES "jsuis là"\n')
    
    for (const [convId, messages] of byConversation.entries()) {
        const firstBadMsg = messages[0]
        
        // Récupérer les messages juste avant
        const beforeMessages = await prisma.message.findMany({
            where: {
                conversationId: convId,
                timestamp: { lt: firstBadMsg.timestamp }
            },
            orderBy: { timestamp: 'desc' },
            take: 3
        })
        
        const contact = firstBadMsg.conversation?.contact
        console.log(`\nConversation ${convId} - ${contact?.name || 'Inconnu'}:`)
        console.log('Messages précédents (du plus récent au plus ancien):')
        for (const m of beforeMessages.reverse()) {
            const sender = m.sender === 'contact' ? '👤' : '🤖'
            console.log(`  ${sender} ${m.message_text?.substring(0, 60)}`)
        }
        console.log(`  🤖 ${firstBadMsg.message_text?.substring(0, 60)} ← RÉPONSE "jsuis là"`)
    }
    
    // 3. Vérifier si toutes ces conversations utilisent le même agent/prompt
    console.log('\n\n' + '═'.repeat(100))
    console.log('🔍 ANALYSE DES AGENTS\n')
    
    const agentIds = new Set<string>()
    for (const [_, messages] of byConversation.entries()) {
        const agentId = messages[0].conversation?.agentId
        if (agentId) agentIds.add(agentId)
    }
    
    console.log(`Agents concernés: ${Array.from(agentIds).join(', ')}`)
    
    for (const agentId of agentIds) {
        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            include: {
                agentPrompts: { include: { prompt: true } }
            }
        })
        
        if (agent) {
            console.log(`\n🤖 ${agent.name} (${agentId}):`)
            console.log(`   Prompts: ${agent.agentPrompts.map(ap => ap.type).join(', ')}`)
            
            // Vérifier si le prompt a changé récemment
            for (const ap of agent.agentPrompts) {
                console.log(`   ${ap.type}: ${ap.prompt.system_prompt?.substring(0, 100)}...`)
            }
        }
    }
    
    await prisma.$disconnect()
}

investigate().catch(console.error)
