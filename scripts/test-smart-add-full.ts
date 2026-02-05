/**
 * Test complet du Smart Add avec:
 * 1. Génération de contexte
 * 2. Extraction de facts pour Mem0
 * 3. Vérification de l'AgentContact binding
 * 4. Vérification du leadContext dans la conversation
 */

import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { memoryService } from '@/lib/memory'
import { memoryExtractionService } from '@/lib/services/memory-extraction'
import { settingsService } from '@/lib/settings-cache'

async function testSmartAddFull() {
    console.log('🧪 Testing Smart Add Full Flow...\n')

    const TEST_PHONE = '+33600000999'
    const TEST_AGENT_ID = 'cmkvfuyar00004uaximi0hhqw' // Lena
    const TEST_PLATFORM = 'Instagram'
    const TEST_CONVERSATION = `hey ! jsuis sur insta là, tu m'as ajouté hier
    
Moi: ouais salut ! t'es qui ?
Lui: Je suis Marc, 17 ans, j'habite à Lyon
Moi: ah cool moi jsuis Lena, 14 ans et toi ?
Lui: ouais 17 ans comme j'ai dit 😄 tu fais quoi dans la vie ?
Moi: jsuis au collège, j'adore le dessin et les jeux vidéo
Lui: grave ! moi je suis fan de foot, j'ai un match demain
Moi: nice ! bonne chance pour ton match alors
Lui: merci ! tu devrais venir me voir jouer un jour
Moi: haha peut-être ouais, faut voir`

    try {
        // 1. Get settings and Venice API key
        console.log('📡 Step 1: Loading settings...')
        const settings = await settingsService.getSettings()
        if (!settings.venice_api_key) {
            console.error('❌ No Venice API key!')
            process.exit(1)
        }
        console.log('✅ Settings loaded')

        // 2. Generate context with Venice
        console.log('\n🤖 Step 2: Generating context with Venice AI...')
        const prompt = `Tu es une ado de 14 ans. Tu vas reprendre cette conversation sur WhatsApp.
Génère UN SEUL paragraphe de contexte (max 200 mots) à retenir pour continuer naturellement. Inclus:
- Son prénom/surnom
- Son âge si mentionné
- D'où il vient
- Ses hobbies/intérêts
- Tout ce qui est important
- Plateforme d'origine: ${TEST_PLATFORM}

Retourne UNIQUEMENT le paragraphe, pas de JSON, pas de titre.`

        const generatedContext = await venice.chatCompletion(
            prompt,
            [],
            TEST_CONVERSATION,
            {
                apiKey: settings.venice_api_key,
                model: settings.venice_model || 'venice-uncensored',
                temperature: 0.5,
                max_tokens: 300
            }
        )

        console.log('✅ Context generated:')
        console.log('─'.repeat(60))
        console.log(generatedContext)
        console.log('─'.repeat(60))

        // 3. Extract facts for Mem0
        console.log('\n🧠 Step 3: Extracting facts for Mem0...')
        const facts = await memoryExtractionService.extractFacts(
            `Conversation context from ${TEST_PLATFORM}:\n${generatedContext}`,
            settings
        )
        console.log(`✅ Extracted ${facts.length} facts:`)
        facts.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))

        // 4. Store in Mem0
        console.log('\n💾 Step 4: Storing in Mem0...')
        const userId = memoryService.buildUserId(TEST_PHONE, TEST_AGENT_ID)
        
        // Clean up any existing test memories
        await memoryService.deleteAll(userId)
        console.log('  🧹 Cleaned existing test memories')
        
        if (facts.length > 0) {
            await memoryService.addMany(userId, facts)
            console.log(`✅ Stored ${facts.length} facts in Mem0`)
        } else {
            await memoryService.add(userId, `Context from ${TEST_PLATFORM}: ${generatedContext.substring(0, 200)}`)
            console.log('✅ Stored summary context in Mem0')
        }

        // 5. Verify memories were stored
        console.log('\n🔍 Step 5: Verifying Mem0 storage...')
        const memories = await memoryService.getAll(userId)
        console.log(`✅ Retrieved ${memories.length} memories from Mem0:`)
        memories.forEach((m: any, i: number) => {
            const text = typeof m === 'string' ? m : m.memory
            console.log(`  ${i + 1}. ${text?.substring(0, 80)}...`)
        })

        // 6. Create/Update contact
        console.log('\n👤 Step 6: Creating test contact...')
        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: TEST_PHONE },
            update: {
                notes: `[Smart Add - ${TEST_PLATFORM}]\n${generatedContext}`,
                name: 'Marc (Test)'
            },
            create: {
                phone_whatsapp: TEST_PHONE,
                name: 'Marc (Test)',
                source: 'smart_add_test',
                notes: `[Smart Add - ${TEST_PLATFORM}]\n${generatedContext}`,
                status: 'new'
            }
        })
        console.log(`✅ Contact created/updated: ${contact.id}`)

        // 7. Create AgentContact binding
        console.log('\n🔗 Step 7: Creating AgentContact binding...')
        const agentContact = await prisma.agentContact.upsert({
            where: {
                agentId_contactId: {
                    agentId: TEST_AGENT_ID,
                    contactId: contact.id
                }
            },
            update: {},
            create: {
                agentId: TEST_AGENT_ID,
                contactId: contact.id,
                signals: [],
                trustScore: 0,
                phase: 'CONNECTION'
            }
        })
        console.log(`✅ AgentContact binding created: ${agentContact.id}`)

        // 8. Create conversation with leadContext
        console.log('\n💬 Step 8: Creating conversation with leadContext...')
        const agentPrompt = await prisma.agentPrompt.findFirst({
            where: { agentId: TEST_AGENT_ID, type: 'CORE' }
        })
        // Fallback: use any prompt (even inactive) if no active prompt found
        const anyPrompt = await prisma.prompt.findFirst()
        const promptId = agentPrompt?.promptId || anyPrompt?.id

        if (!promptId) {
            console.error('❌ No prompt found!')
            process.exit(1)
        }
        console.log(`  Using prompt ID: ${promptId}`)

        // Delete any existing test conversation
        await prisma.conversation.deleteMany({
            where: {
                contactId: contact.id,
                agentId: TEST_AGENT_ID
            }
        })

        const conversation = await prisma.conversation.create({
            data: {
                contactId: contact.id,
                promptId: promptId,
                agentId: TEST_AGENT_ID,
                status: 'paused',
                ai_enabled: true,
                metadata: {
                    state: 'WAITING_FOR_LEAD',
                    leadContext: generatedContext,
                    platform: TEST_PLATFORM,
                    contactType: 'whatsapp'
                }
            }
        })
        console.log(`✅ Conversation created: ${conversation.id}`)
        console.log(`   Status: ${conversation.status}`)
        console.log(`   leadContext stored: ${(conversation.metadata as any)?.leadContext ? 'YES' : 'NO'}`)

        // 9. Verify the flow
        console.log('\n✅ TEST COMPLETE! Summary:')
        console.log('─'.repeat(60))
        console.log(`📞 Contact: ${contact.phone_whatsapp}`)
        console.log(`👤 Name: ${contact.name}`)
        console.log(`🔗 AgentContact: ${agentContact.id}`)
        console.log(`💬 Conversation: ${conversation.id}`)
        console.log(`🧠 Memories stored: ${memories.length}`)
        console.log(`📋 Context length: ${generatedContext.length} chars`)
        console.log('─'.repeat(60))

        console.log('\n🎯 Next steps to test manually:')
        console.log('1. Open the workspace for agent Lena')
        console.log('2. Check that contact +33600000999 appears in the list')
        console.log('3. Send a test message to trigger the conversation')
        console.log('4. Verify the AI response uses the leadContext and Mem0 facts')

        // Cleanup option
        console.log('\n🧹 To clean up test data, run:')
        console.log(`   npx tsx scripts/cleanup-smart-add-test.ts`)

    } catch (error) {
        console.error('\n❌ Test failed:', error)
        process.exit(1)
    }
}

testSmartAddFull()
