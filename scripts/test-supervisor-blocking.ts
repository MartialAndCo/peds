/**
 * TEST SUPERVISOR BLOQUANT via handleChat
 * Simule un vrai message webhook pour tester la régénération
 */

import { handleChat } from '../lib/handlers/chat'
import { prisma } from '../lib/prisma'
import { settingsService } from '../lib/settings-cache'

async function getTestData() {
    // Récupère un agent existant avec profil
    const agent = await prisma.agent.findFirst({
        where: { isActive: true },
        include: { profile: true },
        orderBy: { createdAt: 'desc' }
    })
    
    if (!agent) throw new Error('Aucun agent trouvé')
    
    // Crée un contact de test dédié
    const contact = await prisma.contact.upsert({
        where: { phone_whatsapp: '+33699999999' },
        update: {},
        create: {
            id: 'test-supervisor-contact',
            name: 'TestSupervisor',
            phone_whatsapp: '+33699999999',
            status: 'active'
        }
    })
    
    // Crée la conversation avec historique de répétitions
    const conversation = await prisma.conversation.upsert({
        where: { 
            id: 999999 
        },
        update: {
            status: 'active',
            ai_enabled: true
        },
        create: {
            id: 999999,
            contactId: contact.id,
            agentId: agent.id,
            promptId: 1,
            status: 'active',
            ai_enabled: true
        }
    })
    
    // Crée AgentContact
    await prisma.agentContact.upsert({
        where: {
            agentId_contactId: {
                agentId: agent.id,
                contactId: contact.id
            }
        },
        update: { phase: 'CONNECTION' },
        create: {
            agentId: agent.id,
            contactId: contact.id,
            phase: 'CONNECTION',
            signals: []
        }
    })
    
    // Ajoute l'historique avec répétitions
    await prisma.message.deleteMany({ where: { conversationId: conversation.id } })
    
    const messages = [
        { sender: 'contact', text: 'hello', id: 'msg-1' },
        { sender: 'ai', text: 'Be patient, love. More soon.', id: 'msg-2' },
        { sender: 'contact', text: 'what?', id: 'msg-3' },
        { sender: 'ai', text: 'Be patient, love. More soon.', id: 'msg-4' },
        { sender: 'contact', text: 'again?', id: 'msg-5' },
    ]
    
    for (const msg of messages) {
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: msg.sender as any,
                message_text: msg.text,
                waha_message_id: msg.id,
                timestamp: new Date()
            }
        })
    }
    
    // Récupère les settings
    const settings = await settingsService.getSettings()
    
    console.log(`📋 Test Setup:`)
    console.log(`   Agent: ${agent.name} (${agent.id})`)
    console.log(`   Contact: ${contact.name} (${contact.id})`)
    console.log(`   Conversation: ${conversation.id}`)
    console.log(`   Historique: 2x "Be patient" dans les réponses IA\n`)
    
    return { agent, contact, conversation, settings }
}

async function testSupervisorBlocking() {
    console.log('🔥 TEST: Supervisor bloquant via handleChat')
    console.log('═'.repeat(60))
    
    const { agent, contact, conversation, settings } = await getTestData()
    
    // Simule un payload webhook
    const payload = {
        id: 'test-msg-' + Date.now(),
        from: contact.phone_whatsapp,
        fromMe: false,
        timestamp: Math.floor(Date.now() / 1000),
        type: 'chat',
        messageKey: { id: 'test-key' }
    }
    
    console.log('📝 Envoi message: "again?"')
    console.log('⏳ handleChat en cours...\n')
    
    const start = Date.now()
    
    try {
        const result = await handleChat(
            payload,
            contact,
            conversation,
            settings,
            'again?',  // messageText
            agent.id,
            'whatsapp'
        )
        
        const duration = Date.now() - start
        
        console.log(`\n✅ Terminé en ${duration}ms`)
        console.log(`   Résultat: ${result.result}`)
        
        // Récupère la réponse de la queue (car elle a été mise en queue)
        const lastQueuedMsg = await prisma.messageQueue.findFirst({
            where: { 
                conversationId: conversation.id
            },
            orderBy: { createdAt: 'desc' }
        })
        
        if (lastQueuedMsg) {
            console.log(`   Réponse IA (queued): "${lastQueuedMsg.content}"`)
            
            // Vérifie si c'est une répétition
            const isRepetition = lastQueuedMsg.content.toLowerCase().includes('be patient') ||
                                lastQueuedMsg.content.toLowerCase().includes('more soon')
            
            if (isRepetition) {
                console.log(`\n   ❌ ÉCHEC: Le supervisor n'a PAS bloqué la répétition!`)
                return false
            } else {
                console.log(`\n   ✅ SUCCÈS: Réponse différente générée et validée!`)
                
                if (duration > 8000) {
                    console.log(`   ℹ️  Durée longue (${duration}ms) = probablement régénération`)
                }
                
                return true
            }
        } else {
            console.log(`\n   ⚠️  Aucune réponse en queue trouvée`)
            return false
        }
        
    } catch (e: any) {
        console.log(`\n   💥 ERREUR: ${e.message}`)
        console.log(e.stack)
        return false
    }
}

async function cleanup() {
    console.log('\n🧹 Cleanup...')
    await prisma.messageQueue.deleteMany({ where: { conversationId: 999999 } })
    await prisma.message.deleteMany({ where: { conversationId: 999999 } })
    await prisma.conversation.deleteMany({ where: { id: 999999 } })
    await prisma.agentContact.deleteMany({ where: { contactId: 'test-supervisor-contact' } })
    await prisma.contact.deleteMany({ where: { id: 'test-supervisor-contact' } })
    console.log('   ✅ Done')
}

async function main() {
    console.log('\n' + '🔴'.repeat(30))
    console.log('  TEST SUPERVISOR BLOQUANT (handleChat)')
    console.log('🔴'.repeat(30) + '\n')
    
    try {
        const passed = await testSupervisorBlocking()
        
        await cleanup()
        
        console.log('\n' + (passed ? '✅ TEST PASSÉ' : '❌ TEST ÉCHOUÉ'))
        process.exit(passed ? 0 : 1)
        
    } catch (e) {
        console.error(e)
        await cleanup()
        process.exit(1)
    }
}

main()
