#!/usr/bin/env tsx
/**
 * Investigation des doublons suspects
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigate() {
    console.log('🚨 INVESTIGATION DES MESSAGES DUPLIQUÉS\n')
    
    // 1. Récupérer les messages "jsuis là..." en PENDING
    const pendingMessages = await prisma.messageQueue.findMany({
        where: {
            content: { contains: 'jsuis là' },
            status: 'PENDING'
        },
        include: {
            contact: true,
            conversation: {
                include: {
                    messages: {
                        orderBy: { timestamp: 'desc' },
                        take: 3
                    }
                }
            }
        }
    })
    
    console.log(`📍 ${pendingMessages.length} messages PENDING trouvés\n`)
    
    for (const msg of pendingMessages) {
        console.log('─'.repeat(60))
        console.log(`🆔 Queue ID: ${msg.id}`)
        console.log(`👤 Contact: ${msg.contact?.name || 'Inconnu'} (${msg.contact?.phone_whatsapp})`)
        console.log(`📱 Contact ID: ${msg.contactId}`)
        console.log(`💬 Conversation ID: ${msg.conversationId}`)
        console.log(`🕐 Créé: ${msg.createdAt.toISOString()}`)
        console.log(`📅 Programmé: ${msg.scheduledAt.toISOString()}`)
        console.log(`📝 Contenu: "${msg.content}"`)
        
        // Voir les derniers messages de la conversation
        console.log('\n📜 Derniers messages de la conversation:')
        for (const m of msg.conversation?.messages || []) {
            const sender = m.sender === 'contact' ? '👤' : '🤖'
            console.log(`   ${sender} ${m.message_text.substring(0, 60)}...`)
        }
        console.log('')
    }
    
    // 2. Vérifier s'il y a un pattern dans les conversations
    console.log('\n' + '═'.repeat(60))
    console.log('🔍 ANALYSE DES CONVERSATIONS CONCERNÉES\n')
    
    const conversationIds = pendingMessages.map(m => m.conversationId)
    
    const conversations = await prisma.conversation.findMany({
        where: { id: { in: conversationIds } },
        include: {
            contact: true,
            agent: true
        }
    })
    
    for (const conv of conversations) {
        console.log(`Conversation ${conv.id}:`)
        console.log(`  Agent: ${conv.agent?.name || 'N/A'} (${conv.agentId})`)
        console.log(`  Contact: ${conv.contact?.name || 'Inconnu'} (${conv.contact?.phone_whatsapp})`)
        console.log(`  Status: ${conv.status}`)
        console.log('')
    }
    
    // 3. Vérifier les messages SENT similaires
    console.log('═'.repeat(60))
    console.log('📤 MESSAGES DÉJÀ ENVOYÉS AVEC TEXTE SIMILAIRE\n')
    
    const sentMessages = await prisma.messageQueue.findMany({
        where: {
            content: { contains: 'jsuis là' },
            status: 'SENT',
            createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24h
        },
        include: { contact: true },
        take: 10
    })
    
    for (const msg of sentMessages) {
        console.log(`✅ Envoyé à ${msg.contact?.name || 'Inconnu'} (${msg.contact?.phone_whatsapp})`)
        console.log(`   Le: ${msg.createdAt.toISOString()}`)
        console.log(`   Texte: "${msg.content?.substring(0, 80)}..."`)
        console.log('')
    }
    
    await prisma.$disconnect()
}

investigate().catch(console.error)
