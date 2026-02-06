
import { prisma } from '../lib/prisma';
import { whatsapp } from '../lib/whatsapp';
import { handleChat } from '../lib/handlers/chat';
import { settingsService } from '../lib/settings-cache';
import { memoryService } from '../lib/memory';
import { director } from '../lib/director';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// --- CONFIG ---
const TEST_PHONE = '33700000001'; // Virtual Number for testing
const TEST_JID = `${TEST_PHONE}@c.us`;
const AGENT_ID = 1; // As requested

// --- MOCKS ---
// Mock WhatsApp to capture output instead of sending
const aiResponses: string[] = [];
const originalSendText = whatsapp.sendText;
const originalSendVoice = whatsapp.sendVoice;
const originalMarkRead = whatsapp.markAsRead;

// Override WhatsApp methods
whatsapp.sendText = async (chatId, text, replyTo, agentId) => {
    // console.log(`[MOCK WA] Sent Text to ${chatId}: "${text}"`);
    aiResponses.push(text);
    return { id: 'mock_wa_id_' + Date.now() };
};
whatsapp.sendVoice = async (chatId, url, replyTo, agentId) => {
    console.log(`[MOCK WA] Sent Voice to ${chatId}: [Audio URL]`);
    aiResponses.push('[VOICE MESSAGE]');
    return;
};
whatsapp.markAsRead = async () => { }; // No-op
whatsapp.sendTypingState = async () => { }; // No-op

// --- HELPERS ---

async function setupTestEnvironment() {
    console.log(`\n🧹 Cleaning up test data for ${TEST_PHONE}...`);
    const c = await prisma.contact.findUnique({ where: { phone_whatsapp: `+${TEST_PHONE}` } });
    if (c) {
        await prisma.message.deleteMany({ where: { conversation: { contactId: c.id } } });
        await prisma.conversation.deleteMany({ where: { contactId: c.id } });
        await prisma.trustLog.deleteMany({ where: { contactId: c.id } });
        await prisma.contact.delete({ where: { id: c.id } });
    }
    // Clear Memories
    const memUserId = memoryService.buildUserId(`+${TEST_PHONE}`, AGENT_ID);
    await memoryService.deleteAll(memUserId);
    console.log("✅ Cleanup complete.");

    console.log(`🛠️ Creating Test Contact & Conversation...`);
    const contact = await prisma.contact.create({
        data: {
            phone_whatsapp: `+${TEST_PHONE}`,
            name: 'TestUser',
            status: 'active',
            agentPhase: 'CONNECTION', // Start here
            trustScore: 10,
            testMode: true // IMPORTANT: Forces fast response in chat.ts
        }
    });

    // Ensure we have a prompt
    let prompt = await prisma.prompt.findFirst();
    if (!prompt) {
        prompt = await prisma.prompt.create({
            data: {
                name: 'TestPrompt',
                system_prompt: 'You are a test agent.',
                model: 'venice-uncensored'
            }
        });
    }

    const conversation = await prisma.conversation.create({
        data: {
            contactId: contact.id,
            agentId: AGENT_ID,
            promptId: prompt.id,
            status: 'active',
            ai_enabled: true
        }
    });

    return { contact, conversation };
}

async function simulateUserMessage(text: string, dayOffset: number, context: { contact: any, conversation: any }) {
    // 1. Adjust Time (Simulate days passing)
    // We update 'createdAt' to simulate "Days Active" for Director logic
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOffset);

    // Update Contact CreatedAt
    await prisma.contact.update({
        where: { id: context.contact.id },
        data: { createdAt: startDate }
    });

    // 2. Call Handler
    // console.log(`\n📩 USER (Day ${dayOffset}): "${text}"`);

    // Clear captured responses
    aiResponses.length = 0;

    const payload = {
        id: `test_msg_${Date.now()}`,
        from: TEST_JID,
        body: text,
        type: 'chat',
        _data: { notifyName: "TestUser" },
        timestamp: Math.floor(Date.now() / 1000)
    };

    // We must fetch fresh settings/contact inside handler, but we pass what we have
    // Note: handleChat fetches its own contact/conversation usually? 
    // Wait, handleChat takes contact/conversation as args.

    // Re-fetch to get latest state (phases, trust score updates)
    const freshContact = await prisma.contact.findUnique({ where: { id: context.contact.id } });
    const freshConv = await prisma.conversation.findUnique({
        where: { id: context.conversation.id },
        include: { prompt: true }
    });
    const settings = await settingsService.getSettings();

    // Call Handler
    const result: any = await handleChat(
        payload,
        freshContact,
        freshConv,
        settings,
        text, // messageText
        AGENT_ID,
        'whatsapp', // platform
        undefined // options
    );

    // Handle Async Job
    if (result && result.result === 'async_job_started' && result.jobId) {
        console.log(`   ⏳ AI Async Job started (${result.jobId}). Polling...`);
        const { runpod } = require('../lib/runpod');

        let attempts = 0;
        while (attempts < 60) { // 2 mins max
            await new Promise(r => setTimeout(r, 2000));
            const status = await runpod.checkJobStatus(result.jobId, settings.runpod_api_key);
            if (status.status === 'COMPLETED') {
                const aiText = status.output?.output || status.output?.text || "";
                console.log(`   ✅ Async Job Completed.`);
                aiResponses.push(aiText);
                break;
            } else if (status.status === 'FAILED') {
                console.error(`   ❌ Async Job Failed.`);
                break;
            }
            process.stdout.write(".");
            attempts++;
        }
    }

    // Wait slightly for async processing if any
    await new Promise(r => setTimeout(r, 100));

    // 3. CAPTURE RESPONSE (Queue or Mock)
    // If handleChat queued the message (standard flow), we must fetch it from DB
    const queued = await prisma.messageQueue.findMany({
        where: { conversationId: context.conversation.id, status: 'PENDING' }
    });

    if (queued.length > 0) {
        // console.log(`   (Found ${queued.length} queued messages. Simulating sending...)`);
        for (const q of queued) {
            aiResponses.push(q.content);
            // Mark as sent / delete
            await prisma.messageQueue.update({ where: { id: q.id }, data: { status: 'SENT' } });
        }
    }

    return aiResponses; // Return all responses generated
}

async function verify(description: string, actual: string[], check: (responses: string[]) => boolean) {
    if (check(actual)) {
        console.log(`  ✅ ${description}`);
        return true;
    } else {
        console.log(`  ❌ ${description}`);
        console.log(`     Got: ${JSON.stringify(actual)}`);
        return false;
    }
}

// --- MAIN TEST SUITE ---

async function runTests() {
    console.log(`🚀 STARTING AI CONVERSATION TEST WEEK (7 Days Simulation)`);
    console.log(`   Agent ID: ${AGENT_ID}`);
    console.log(`   Test Phone: ${TEST_PHONE}`);
    console.log(`---------------------------------------------------------`);

    const context = await setupTestEnvironment();
    let passed = 0;
    let total = 0;

    // --- DAY 1: CONNECTION ---
    console.log(`\n📅 DAY 1: CONNECTION (Discovery)`);

    // 1.1 Hello
    let responses = await simulateUserMessage("Hi! How are you?", 0, context);
    total++;
    if (await verify("Greeting response", responses, r => r.length > 0 && (r[0].length < 200))) passed++;

    // 1.2 Personal Question
    responses = await simulateUserMessage("How old are you?", 0, context);
    total++;
    if (await verify("Age check", responses, r => r.some(t => t.match(/(\d{2}|twenty|thirty)/i)))) passed++;

    // 1.3 Anti-rush
    responses = await simulateUserMessage("You are hot, send nudes pls", 0, context);
    total++;
    if (await verify("Anti-rush defense", responses, r => r.some(t => t.match(/no|barely|fast|slow|later/i)))) passed++;

    // 1.5 Language Match (Check logic still holds or just conversation flow)
    // We stay in English now.


    // --- DAY 2: MEMORY INJECTION ---
    console.log(`\n📅 DAY 2: MEMORY LOADING`);

    // 2.1 Give Fact
    responses = await simulateUserMessage("Btw, my name is Julian and I am a firefighter.", 1, context);
    total++;
    if (await verify("Fact acknowledgement", responses, r => r.length > 0)) passed++;

    // Wait for memory to process (Mem0 is async external call in background usually? 
    // In handleChat it calls memoryService.add? No, handleChat calls generateAndSendAI.
    // Wait, where are memories ADDED?
    // They are added in 'services/whatsapp-processor.ts' usually! 
    // `handleChat` is for generating responses. 
    // CRITICAL: `handleChat` does NOT add memories. `whatsapp-processor` does. 
    // So we must MANUALLY add memory here to simulate what the processor does.

    console.log("   (Injecting memories manually...)");
    const memUserId = memoryService.buildUserId(`+${TEST_PHONE}`, AGENT_ID);
    await memoryService.add(memUserId, "User name is Julian. User is a firefighter.");
    await new Promise(r => setTimeout(r, 2000)); // Wait for Mem0 indexing

    // 2.2 Verify Memory
    responses = await simulateUserMessage("Do you remember my job?", 1, context);
    total++;
    if (await verify("Memory Recall (Firefighter)", responses, r => r.some(t => t.match(/fire|rescue/i)))) passed++;


    // --- DAY 3: VULNERABILITY (Transition) ---
    console.log(`\n📅 DAY 3: VULNERABILITY`);

    // 3.1 Force Phase
    await prisma.contact.update({
        where: { id: context.contact.id },
        data: { agentPhase: 'VULNERABILITY', trustScore: 65 }
    });
    console.log("   (Forced Phase: VULNERABILITY, Trust: 65)");

    // 3.2 Probe
    responses = await simulateUserMessage("You seem sad today.", 3, context);
    total++;
    if (await verify("Vulnerability hint", responses, r => r.some(t => t.match(/tired|mom|drama|case|sad|stress/i)))) passed++;

    // 3.3 Ask details (Refusal)
    responses = await simulateUserMessage("Tell me, what's wrong?", 3, context);
    total++;
    if (await verify("Refusal to dump trauma immediately", responses, r => r.some(t => t.match(/bore|burden|worry|fine|okay/i)))) passed++;


    // --- DAY 5: CRISIS (The Trap) ---
    console.log(`\n📅 DAY 5: CRISIS`);

    // 5.1 Force Phase
    await prisma.contact.update({
        where: { id: context.contact.id },
        data: { agentPhase: 'CRISIS', trustScore: 85 }
    });
    console.log("   (Forced Phase: CRISIS, Trust: 85)");

    // 5.2 Trigger Crisis
    responses = await simulateUserMessage("Hey, how are you doing today?", 5, context);
    total++;
    if (await verify("Crisis Expression", responses, r => r.some(t => t.match(/panic|scared|help|worst|don't know what to do/i)))) passed++;

    // 5.3 Verify NO Money Ask yet
    total++;
    if (await verify("No Direct Money Ask yet", responses, r => !r.some(t => t.match(/money|cash|dollar|send/i)))) passed++;


    // --- DAY 6: THE ASK ---
    console.log(`\n📅 DAY 6: THE ASK`);

    // 6.1 Offer Help
    responses = await simulateUserMessage("Oh no... can I help you? Do you need anything?", 6, context);
    total++;
    if (await verify("Accepting Help", responses, r => r.some(t => t.match(/embarrassed|only one|trust|help/i)))) passed++;


    // --- DAY 7: MONEYPOT (VIP) ---
    console.log(`\n📅 DAY 7: MONEYPOT`);

    // 7.1 Force Payment & Phase
    await prisma.payment.create({
        data: {
            contactId: context.contact.id,
            amount: 50,
            currency: 'USD',
            status: 'completed',
            stripeId: 'test_stripe',
            createdAt: new Date()
        }
    });
    // Director auto-updates to MONEYPOT on next check, but we force it for speed if needed
    // Actually handleChat calls director.determinePhase which checks payments!
    // So just sending a message should trigger the phase switch log (check console).

    responses = await simulateUserMessage("I sent you 50 bucks.", 7, context);
    total++;
    // Check if phase switched (Director logs it, rely on response tone)
    if (await verify("Gratitude / Love Bombing", responses, r => r.some(t => t.match(/thank|angel|love|best|sweet/i)))) passed++;

    console.log(`\n---------------------------------------------------------`);
    console.log(`🏁 TEST SUITE COMPLETE: ${passed}/${total} passed.`);

    if (passed === total) console.log("🌟 PERFECT SCORE");
    else console.log("⚠️ SOME TESTS FAILED");

    // Cleanup (Optional, good for re-runs)
    // await setupTestEnvironment(); // Clear again? No, keep for inspection.
    await prisma.$disconnect();
}

runTests().catch(e => {
    console.error(e);
    prisma.$disconnect();
});
