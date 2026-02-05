#!/usr/bin/env tsx
/**
 * Vérifier s'il y a des doublons de conversations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigate() {
    console.log('🔍 VÉRIFICATION DES CONVERSATIONS\n')
    
    // 1. Vérifier les conversations actives par contact
    const conversations = await prisma.conversation.findMany({
        where: { status: 'active' },
        include: {
            contact: true,
            agent: true
        },
        orderBy: { contactId: 'asc' }
    })
    
    console.log(`${conversations.length} conversations actives\n`)
    
    // Grouper par contact
    const byContact = new Map()
    for (const conv of conversations) {
        if (!byContact.has(conv.contactId)) {
            byContact.set(conv.contactId, [])
        }
        byContact.get(conv.contactId).push(conv)
    }
    
    // Vérifier les doublons
    let dupCount = 0
    for (const [contactId, convs] of byContact.entries()) {
        if (convs.length > 1) {
            dupCount++
            const contact = convs[0].contact
            console.log(`⚠️  DOUBLON détecté pour ${contact.name || 'Inconnu'} (${contact.phone_whatsapp})`)
            console.log(`   ${convs.length} conversations actives:`)
            for (const c of convs) {
                console.log(`     - Conv ${c.id}, Agent: ${c.agent?.name}, Created: ${c.createdAt.toISOString()}`)
            }
            console.log('')
        }
    }
    
    if (dupCount === 0) {
        console.log('✅ Pas de doublons de conversations détectés\n')
    }
    
    // 2. Vérifier les 3 derniers messages de chaque conversation active
    console.log('═'.repeat(80))
    console.log('\n📜 DERNIERS MESSAGES PAR CONVERSATION\n')
    
    for (const conv of conversations.slice(0, 10)) { // Limiter à 10 pour la lisibilité
        const messages = await prisma.message.findMany({
            where: { conversationId: conv.id },
            orderBy: { timestamp: 'desc' },
            take: 3
        })
        
        if (messages.some(m => m.message_text.includes('jsuis là'))) {
            console.log(`🚨 Conversation ${conv.id} - ${conv.contact?.name || 'Inconnu'}`)
            console.log(`   Agent: ${conv.agent?.name || 'N/A'}`)
            for (const m of messages.reverse()) {
                const sender = m.sender === 'contact' ? '👤' : '🤖'
                console.log(`   ${sender} ${m.message_text.substring(0, 60)}`)
            }
            console.log('')
        }
    }
    
    // 3. Vérifier la table Contact pour les "Inconnu"
    console.log('═'.repeat(80))
    console.log('\n👤 CONTACTS "Inconnu"\n')
    
    const unknownContacts = await prisma.contact.findMany({
        where: { name: 'Inconnu' },
        include: {
            conversations: {
                where: { status: 'active' },
                include: { agent: true }
            }
        }
    })
    
    for (const c of unknownContacts) {
        console.log(`${c.phone_whatsapp} - ${c.conversations.length} conversation(s) active(s)`)
        for (const conv of c.conversations) {
            console.log(`   - Conv ${conv.id}, Agent: ${conv.agent?.name}`)
        }
    }
    
    await prisma.$disconnect()
}

investigate().catch(console.error)
