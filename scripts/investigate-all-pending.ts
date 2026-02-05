#!/usr/bin/env tsx
/**
 * Tous les messages PENDING détaillés
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigate() {
    console.log('🔍 TOUS LES MESSAGES PENDING\n')
    
    const pending = await prisma.messageQueue.findMany({
        where: { status: 'PENDING' },
        orderBy: { scheduledAt: 'asc' },
        include: {
            contact: true,
            conversation: { include: { agent: true } }
        }
    })
    
    console.log(`Total: ${pending.length} messages PENDING\n`)
    console.log('═'.repeat(80))
    
    for (const msg of pending) {
        const now = new Date()
        const diffMinutes = Math.round((msg.scheduledAt.getTime() - now.getTime()) / 60000)
        const diffHours = Math.round(diffMinutes / 60 * 10) / 10
        
        console.log(`\n🆔 ${msg.id}`)
        console.log(`👤 ${msg.contact?.name || 'Inconnu'} (${msg.contact?.phone_whatsapp})`)
        console.log(`🤖 Agent: ${msg.conversation?.agent?.name || 'N/A'}`)
        console.log(`📅 Programmé: ${diffMinutes > 0 ? `dans ${diffMinutes} min (${diffHours}h)` : 'IMMÉDIAT'}`)
        console.log(`📝 "${msg.content}"`)
        console.log(`🔗 ContactID: ${msg.contactId} | ConvID: ${msg.conversationId}`)
        console.log('─'.repeat(80))
    }
    
    await prisma.$disconnect()
}

investigate().catch(console.error)
