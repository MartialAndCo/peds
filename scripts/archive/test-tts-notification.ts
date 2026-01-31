// scripts/test-tts-notification.ts
// Test TTS notification flow: failure → notification → admin response
// Creates temporary test data if none exists

import { prisma } from '../lib/prisma'
import { voiceTtsService } from '../lib/voice-tts'

async function main() {
    console.log('🧪 TTS NOTIFICATION FLOW TEST\n')
    console.log('='.repeat(60))

    // 1. Find or create test data
    let agent = await prisma.agent.findFirst({
        where: { isActive: true },
        include: { profile: true, voiceModel: true }
    })

    if (!agent) {
        console.log('⚠️  No agent found, creating test agent...')
        agent = await prisma.agent.create({
            data: {
                name: 'Test Agent',
                phone: '+1234567890',
                isActive: true
            },
            include: { profile: true, voiceModel: true }
        })
    }

    console.log(`\n📱 Agent: ${agent.name} (${agent.id})`)
    console.log(`   Locale: ${agent.profile?.locale || 'unknown'}`)
    console.log(`   Voice Model: ${agent.voiceModel?.name || 'NONE'}`)

    // Create test contact if needed
    let contact = await prisma.contact.findFirst()
    if (!contact) {
        console.log('⚠️  No contact found, creating test contact...')
        contact = await prisma.contact.create({
            data: {
                phone_whatsapp: '+0987654321',
                name: 'Test Contact'
            }
        })
    }

    // Create test conversation if needed
    let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id }
    })
    if (!conversation) {
        console.log('⚠️  No conversation found, creating test conversation...')
        // Need a prompt first
        let prompt = await prisma.prompt.findFirst()
        if (!prompt) {
            prompt = await prisma.prompt.create({
                data: {
                    name: 'Test Prompt',
                    system_prompt: 'You are a test assistant.',
                    model: 'venice-uncensored'
                }
            })
        }
        conversation = await prisma.conversation.create({
            data: {
                contactId: contact.id,
                promptId: prompt.id,
                agentId: agent.id,
                status: 'active'
            }
        })
    }

    console.log(`\n💬 Conversation: ${conversation.id}`)
    console.log(`   Contact: ${contact.phone_whatsapp}`)

    // 2. Test notification creation
    console.log('\n' + '='.repeat(60))
    console.log('📝 TEST 1: Creating TTS Failure Notification\n')

    const testOptions = {
        contactPhone: contact.phone_whatsapp,
        text: "Hey tu vas bien? J'espère que ta journée se passe bien",
        agentId: agent.id,
        conversationId: conversation.id,
        contactId: contact.id
    }

    await voiceTtsService.notifyTtsFailure(testOptions, 'TEST_ERROR: No voice model configured')

    const notification = await prisma.notification.findFirst({
        where: { type: 'TTS_FAILURE', agentId: agent.id },
        orderBy: { createdAt: 'desc' }
    })

    if (notification) {
        console.log('✅ Notification created successfully!')
        console.log(`   ID: ${notification.id}`)
        console.log(`   Title: ${notification.title}`)
        console.log(`   Message preview: ${notification.message.substring(0, 100)}...`)

        // 3. Test PAUSE action
        console.log('\n' + '='.repeat(60))
        console.log('📝 TEST 2: Admin "Pause" Response\n')

        const pauseResult = await voiceTtsService.handleAdminResponse(notification.id, 'pause')

        if (pauseResult.success) {
            console.log('✅ Pause action executed successfully!')
            const updatedConv = await prisma.conversation.findUnique({
                where: { id: conversation.id }
            })
            console.log(`   Conversation status: ${updatedConv?.status}`)

            // Reset
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { status: 'active' }
            })
            console.log('   (Reset to active)')
        } else {
            console.log('❌ Pause action failed')
        }

        // 4. Test CONTINUE action (AI generation)
        console.log('\n' + '='.repeat(60))
        console.log('📝 TEST 3: Admin "Continue" Response (AI shy refusal)\n')

        // Create new notification for this test
        await voiceTtsService.notifyTtsFailure(testOptions, 'TEST_ERROR: Testing continue flow')

        const continueNotification = await prisma.notification.findFirst({
            where: { type: 'TTS_FAILURE', agentId: agent.id, isRead: false },
            orderBy: { createdAt: 'desc' }
        })

        if (continueNotification) {
            console.log('⚠️  Note: Continue action would call AI and send WhatsApp')
            console.log('   Skipping to avoid actual API calls in test mode\n')

            // Just mark as read without executing
            await prisma.notification.update({
                where: { id: continueNotification.id },
                data: { isRead: true }
            })
            console.log('✅ (Would generate AI shy refusal and send to contact)')
        }

        // Cleanup
        console.log('\n' + '='.repeat(60))
        console.log('🧹 Cleanup\n')

        const deleted = await prisma.notification.deleteMany({
            where: { type: 'TTS_FAILURE', message: { contains: 'TEST_ERROR' } }
        })
        console.log(`   Deleted ${deleted.count} test notifications`)

    } else {
        console.log('❌ Failed to create notification')
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ TTS Notification Tests Complete!\n')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
