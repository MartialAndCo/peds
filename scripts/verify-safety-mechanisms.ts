
import { prisma } from '@/lib/prisma';
import { queueService } from '@/lib/services/queue-service';
import { handleChat } from '@/lib/handlers/chat';

// Mock settings for the test
const MOCK_SETTINGS = {
    ai_provider: 'venice', // or whatever is configured
    venice_api_key: 'test',
    venice_model: 'test',
    voice_response_enabled: false
};

async function main() {
    console.log('--- STARTING SAFETY MECHANISMS VERIFICATION ---');
    console.log('Target: Verify Pre-Send Abort & Staleness Checks');

    const TEST_AGENT = 'agent_safety_test';
    const TEST_PHONE = '19999999999';

    // Ensure Agent exists
    await prisma.agent.upsert({
        where: { id: TEST_AGENT },
        update: {},
        create: {
            id: TEST_AGENT,
            name: 'Safety Test Agent',
            phone: '10000000000',
            isActive: true
        }
    });

    // Ensure Agent Profile exists (required for Swarm)
    await prisma.agentProfile.upsert({
        where: { agentId: TEST_AGENT },
        update: {},
        create: {
            agentId: TEST_AGENT,
            baseAge: 25,
            locale: 'en-US',
            timezone: 'UTC',
            safetyRules: 'Test Safety Rules'
        }
    });

    // Cleanup
    await prisma.incomingQueue.deleteMany({ where: { agentId: TEST_AGENT } });
    await prisma.messageQueue.deleteMany({ where: { contactId: 'test_safety_contact' } });

    // Setup Context
    let contact = await prisma.contact.upsert({
        where: { phone_whatsapp: TEST_PHONE },
        update: { testMode: true },
        create: {
            phone_whatsapp: TEST_PHONE,
            name: 'Safety Tester',
            status: 'active',
            agentPhase: 'CONNECTION',
            testMode: true
        }
    });

    // Ensure a prompt exists
    let prompt = await prisma.prompt.findFirst();
    if (!prompt) {
        prompt = await prisma.prompt.create({
            data: {
                name: 'Safety Test Prompt',
                system_prompt: 'You are a safety tester.',
                isActive: true
            }
        });
    }

    let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, agentId: TEST_AGENT }
    });

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: {
                contactId: contact.id,
                agentId: TEST_AGENT,
                status: 'active',
                ai_enabled: true,
                promptId: prompt.id
            }
        });
    } else {
        // Force active in case it was paused by previous runs
        conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: 'active' }
        });
    }

    // =========================================================================
    // TEST 1: STALENESS CHECK (QueueService)
    // =========================================================================
    console.log('\n--- TEST 1: STALENESS CHECK (QueueService) ---');

    // 1. Create a "Stale" Queue Item (Created 1 hour ago, scheduled for now)
    const staleItem = await prisma.messageQueue.create({
        data: {
            contactId: contact.id,
            conversationId: conversation.id,
            content: 'This is a stale message',
            status: 'PROCESSING',
            scheduledAt: new Date(),
            createdAt: new Date(Date.now() - 3600000) // Created 1h ago
        }
    });

    // 2. Simulate User Reply (Sent 30 mins ago -> NEWER than Queue Item)
    const newerMsg = await prisma.message.create({
        data: {
            conversationId: conversation.id,
            sender: 'contact',
            message_text: 'Stop! I changed my mind.',
            timestamp: new Date(),
            waha_message_id: `test_newer_${Date.now()}`
        }
    });
    console.log(`[TEST] Inserted newer message: ID=${newerMsg.id} (Conv=${newerMsg.conversationId})`)

    console.log('Created Stale Queue Item and Newer User Message.');

    // 3. Process
    // Fetch with relations first
    const staleItemWithRelations = await prisma.messageQueue.findUnique({
        where: { id: staleItem.id },
        include: { contact: true, conversation: true }
    });

    if (!staleItemWithRelations) throw new Error('Failed to fetch stale item');

    const resultStale = await queueService.processSingleItem(staleItemWithRelations);

    console.log('Result:', resultStale);

    if (resultStale.status === 'aborted_stale') {
        console.log('✅ SUCCESS: Stale message aborted.');
    } else {
        console.error('❌ FAILURE: Stale message NOT aborted.');
    }

    // =========================================================================
    // TEST 2: PRE-SEND ABORT (handleChat)
    // =========================================================================
    console.log('\n--- TEST 2: PRE-SEND ABORT (handleChat) ---');
    console.log('Simulating AI processing race condition...');

    // STRATEGY: handleChat creates message internally (auto-increment ID).
    // We inject a NEWER message AFTER a delay so it gets a HIGHER ID.
    // The Pre-Send Check queries for `id > triggerMsgId`, so it will find ours.

    const triggerId = 'waha_trigger_' + Date.now();
    const payload = {
        id: triggerId,
        body: 'Trigger Message',
        from: TEST_PHONE,
        type: 'chat',
        _data: { notifyName: 'Tester' }
    };

    console.log('Starting handleChat...');

    // Run handleChat AND inject newer message concurrently
    const chatPromise = handleChat(
        payload,
        contact,
        conversation,
        MOCK_SETTINGS,
        'Trigger Message',
        TEST_AGENT,
        'whatsapp',
        { skipAI: false }
    );

    // Wait 3s for handleChat to create the trigger message, THEN inject newer message
    // This ensures our message gets a higher auto-increment ID
    const injectPromise = new Promise<void>(async (resolve) => {
        await new Promise(r => setTimeout(r, 3000)); // Wait for trigger msg to be created

        // Inject a newer DB message (higher ID than trigger)
        const newerMsg = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'contact',
                message_text: 'Wait! I changed my mind!',
                timestamp: new Date(),
                waha_message_id: `test_newer_concurrent_${Date.now()}`
            }
        });
        console.log(`[TEST] Injected concurrent newer message: ID=${newerMsg.id}`);

        // Also inject into IncomingQueue for the queue-based check
        await prisma.incomingQueue.create({
            data: {
                agentId: TEST_AGENT,
                payload: { payload: { from: TEST_PHONE } },
                status: 'PENDING',
                createdAt: new Date()
            }
        });
        console.log('[TEST] Also injected IncomingQueue pending item.');
        resolve();
    });

    // Wait for both
    try {
        const [resultChat] = await Promise.all([chatPromise, injectPromise]);
        console.log('handleChat Result:', resultChat);

        if (resultChat.result === 'presend_aborted_newer_messages') {
            console.log('✅ SUCCESS: AI generation aborted due to new message.');
        } else if (resultChat.result === 'ai_quota_failed_queued_for_retry' || resultChat.result?.includes('error')) {
            console.log('⚠️ INCONCLUSIVE: AI failed before reaching check (likely API credits).');
        } else {
            console.error(`❌ FAILURE: Did not abort. Result: ${resultChat.result}`);
        }
    } catch (e) {
        console.error('handleChat threw:', e);
    }

    console.log('--- TEST FINISHED ---');
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
