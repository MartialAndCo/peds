#!/usr/bin/env tsx
/**
 * Script d'initialisation des nouveaux champs de tracking des conversations
 * À exécuter une seule fois après la migration DB
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function initConversationTracking() {
  console.log('🔧 Initialisation des champs de tracking des conversations...\n')

  // 1. Récupérer toutes les conversations
  const conversations = await prisma.conversation.findMany({
    include: {
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1,
        select: {
          sender: true,
          timestamp: true,
        }
      }
    }
  })

  console.log(`📊 ${conversations.length} conversations trouvées`)

  let updated = 0
  let skipped = 0

  for (const conv of conversations) {
    const lastMessage = conv.messages[0]
    
    if (lastMessage) {
      // Mettre à jour avec les données du dernier message
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: lastMessage.timestamp,
          lastMessageSender: lastMessage.sender as string,
          // Calculer le unreadCount (messages du contact non lus par l'admin)
          // Par défaut on met 0 car on ne peut pas savoir rétroactivement
          unreadCount: 0 
        }
      })
      updated++
    } else {
      // Pas de messages, on met juste une valeur par défaut
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: conv.createdAt,
          lastMessageSender: null,
          unreadCount: 0
        }
      })
      skipped++
    }
  }

  console.log(`\n✅ Terminé !`)
  console.log(`   - ${updated} conversations mises à jour avec le dernier message`)
  console.log(`   - ${skipped} conversations sans messages (utilisation de createdAt)`)
  
  // 2. Vérifier le résultat
  const stats = await prisma.conversation.aggregate({
    _count: { id: true },
    _max: { lastMessageAt: true }
  })
  
  console.log(`\n📈 Statistiques:`)
  console.log(`   - Total conversations: ${stats._count.id}`)
  console.log(`   - Dernière activité: ${stats._max.lastMessageAt?.toISOString() || 'N/A'}`)

  await prisma.$disconnect()
}

initConversationTracking().catch((e) => {
  console.error('❌ Erreur:', e)
  process.exit(1)
})
