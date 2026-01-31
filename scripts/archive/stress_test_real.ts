
import { prisma } from '@/lib/prisma'
import { processWhatsAppPayload } from '@/lib/services/whatsapp-processor'
import { trace } from '@/lib/logger'
import fs from 'fs'

// CONFIGURATION
// Use fake numbers that definitely won't match real users
const BASE_PHONE = "998000"
const NUM_WORKERS = 5; // Number of concurrent CRON workers
const AGENT_ID = 1; // Target Agent ID (Must exist)

// 10 DISTINCT SCENARIOS
const SCENARIOS = [
    { name: "The Flirt", messages: ["Hi pretty", "Send pic", "Why not?", "You're boring", "Bye"] },
    { name: "The Student", messages: ["Help with homework", "What is 2+2?", "Who is Einstein?", "Thanks", "Bye"] },
    { name: "The Angry", messages: ["I want a refund", "This service sucks", "Let me speak to manager", "I am suing", "Grrr"] },
    { name: "The Chef", messages: ["Recipe for pasta", "Do I need salt?", "How long to boil?", "Yum", "Thanks"] },
    { name: "The Tech", messages: ["Python vs JS?", "Which is faster?", "Code example?", "Cool", "Exit"] },
    { name: "The Lost", messages: ["Where am I?", "Is this Google?", "I need a bloomingdales", "Help", "Stop"] },
    { name: "The Fan", messages: ["I love you", "Marry me", "Please", "I am rich", "Money sent"] },
    { name: "The Skeptic", messages: ["Are you real?", "Prove it", "Send selfie", "Liar", "Bot"] },
    { name: "The Joker", messages: ["Tell me a joke", "Another one", "That was bad", "Do better", "Lol"] },
    { name: "The Normal", messages: ["Hello", "How are you?", "What are you doing?", "Nice weather", "Bye"] }
];

async function setupUsers() {
    console.log(`[Setup] Creating ${SCENARIOS.length} test users...`);

    // 1. Ensure Agent Exists & Force Venice
    const agent = await prisma.agent.findUnique({ where: { id: AGENT_ID } });
    if (!agent) throw new Error(`Agent ${AGENT_ID} not found!`);

    await prisma.agentSetting.upsert({
        where: { agentId_key: { agentId: AGENT_ID, key: 'ai_provider' } },
        update: { value: 'venice' },
        create: { agentId: AGENT_ID, key: 'ai_provider', value: 'venice' }
    });
    // Ensure model is set (optional, but good for test stability)
    await prisma.agentSetting.upsert({
        where: { agentId_key: { agentId: AGENT_ID, key: 'venice_model' } },
        update: { value: 'venice-uncensored' },
        create: { agentId: AGENT_ID, key: 'venice_model', value: 'venice-uncensored' }
    });

    const userMap = new Map<string, number>(); // Phone -> ContactID

    for (let i = 0; i < SCENARIOS.length; i++) {
        const phone = `${BASE_PHONE}${i.toString().padStart(4, '0')}`;
        const realPhone = `+${phone}`;
        const persona = SCENARIOS[i].name;

        // Clean up previous runs
        await prisma.incomingQueue.deleteMany({ where: { payload: { path: ['from'], equals: `${phone}@c.us` } } });
        await prisma.contact.deleteMany({ where: { phone_whatsapp: realPhone } });

        // CREATE ACTIVE CONVERSATION IMMEDIATELY
        const contact = await prisma.contact.create({
            data: {
                phone_whatsapp: realPhone,
                name: `Test: ${persona}`,
                source: 'STRESS_TEST_V2',
                status: 'new',
                trustScore: 50,
                agentPhase: 'CONNECTION'
            }
        });

        const prompt = await prisma.prompt.findFirst();
        if (!prompt) throw new Error("No Prompt found!");

        await prisma.conversation.create({
            data: {
                contactId: contact.id,
                agentId: AGENT_ID,
                promptId: prompt.id,
                status: 'active', // FORCE ACTIVE
                ai_enabled: true
            }
        });

        userMap.set(realPhone, contact.id);
        console.log(`[Setup] Created User: ${persona} (${realPhone})`);
    }
}

async function injectRound(roundIndex: number) {
    if (roundIndex >= 5) return; // Should not happen if loop checks length
    console.log(`\n[Injector] Starting Round ${roundIndex + 1}...`);

    for (let i = 0; i < SCENARIOS.length; i++) {
        const phone = `${BASE_PHONE}${i.toString().padStart(4, '0')}`;
        const message = SCENARIOS[i].messages[roundIndex];

        if (!message) continue;

        // Mimic the payload structure that /api/webhook/waha receives
        const payload = {
            id: `TEST_MSG_R${roundIndex}_${Date.now()}_${i}`,
            timestamp: Date.now() / 1000,
            from: `${phone}@c.us`,
            body: message,
            fromMe: false,
            type: 'chat',
            _data: { notifyName: SCENARIOS[i].name }
        };

        await prisma.incomingQueue.create({
            data: {
                agentId: AGENT_ID,
                payload: { payload, event: 'message.upsert' },
                status: 'PENDING'
            }
        });
    }
    console.log(`[Injector] Round ${roundIndex + 1} injected (10 messages).`);
}

async function runWorker(workerId: number) {
    console.log(`[Worker ${workerId}] Started.`);
    let processedCount = 0;

    // Run for a fixed duration OR until a stop signal?
    // Let's run until we can't find work for 10 seconds (Keepalive)
    let idleCount = 0;
    const MAX_IDLE = 10; // 10 * 1s = 10s timeout

    while (idleCount < MAX_IDLE) {
        // --- CRON LOGIC REPLICATION START ---

        // 1. Transactional Fetch & Lock
        const items = await prisma.$transaction(async (tx) => {
            const batch = await tx.incomingQueue.findMany({
                where: { status: 'PENDING', agentId: AGENT_ID },
                take: 10,
                orderBy: { createdAt: 'asc' }
            });

            if (batch.length > 0) {
                await tx.incomingQueue.updateMany({
                    where: { id: { in: batch.map(i => i.id) } },
                    data: { status: 'PROCESSING', error: `Worker ${workerId}` } // Mark who took it
                });
            }
            return batch;
        });

        if (items.length === 0) {
            idleCount++;
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s
            continue;
        }

        idleCount = 0; // Reset idle
        console.log(`[Worker ${workerId}] Processing batch of ${items.length} items...`);

        // 2. Processing Loop
        for (const item of items) {
            try {
                const payloadWrapper = item.payload as any;
                const payload = payloadWrapper.payload; // Extract inner payload

                // Call the REAL processor
                const result = await processWhatsAppPayload(payload, item.agentId, { skipAI: false });

                // Check result just for logging
                if (result.status === 'sent' || result.status === 'queued') {
                    // console.log(`[Worker ${workerId}] AI Replied to ${payload.from}`);
                } else {
                    console.log(`[Worker ${workerId}] Status: ${result.status} (No Reply?)`);
                }

                await prisma.incomingQueue.update({
                    where: { id: item.id },
                    data: { status: 'DONE', processedAt: new Date() }
                });
                processedCount++;

            } catch (err: any) {
                console.error(`[Worker ${workerId}] processing error on item ${item.id}:`, err.message);
                await prisma.incomingQueue.update({
                    where: { id: item.id },
                    data: { status: 'FAILED', error: err.message, attempts: { increment: 1 } }
                });
            }
        }
    }
    console.log(`[Worker ${workerId}] Finished (Idle Timeout). Processed ${processedCount} items.`);
}

async function verify() {
    console.log('\n[Verification] Checking results...');

    const users = await prisma.contact.findMany({
        where: { phone_whatsapp: { contains: BASE_PHONE } },
        include: {
            conversations: {
                include: {
                    messages: {
                        orderBy: { timestamp: 'asc' }
                    }
                }
            }
        }
    });

    for (const u of users) {
        const msgs = u.conversations.flatMap(c => c.messages);
        const userMsgs = msgs.filter(m => m.sender === 'contact' || m.sender === 'user');
        const aiMsgs = msgs.filter(m => m.sender === 'ai');

        console.log(`User: ${u.name} | User Msgs: ${userMsgs.length} | AI Msgs: ${aiMsgs.length}`);

        // Sanity Check
        if (userMsgs.length !== 5) console.error(`[WARN] User ${u.name} missed messages!`);
        if (aiMsgs.length < 5) console.error(`[WARN] AI missed replies for ${u.name} (Got ${aiMsgs.length}/5)`);

        // Print the convo for manual review (Truncated)
        if (aiMsgs.length > 0) {
            const lastAi = aiMsgs[aiMsgs.length - 1];
            console.log(`   Last Interaction: User="${userMsgs[userMsgs.length - 1].message_text}" -> AI="${lastAi.message_text.substring(0, 50)}..."`);
        }
    }
}

async function main() {
    try {
        await setupUsers();

        // Start Workers FIRST (They will poll)
        console.log(`[Main] Spawning ${NUM_WORKERS} concurrent workers...`);
        const workerPromises = [];
        for (let i = 0; i < NUM_WORKERS; i++) {
            workerPromises.push(runWorker(i));
        }

        // Inject Rounds Sequentially (allowing time for processing)
        for (let r = 0; r < 5; r++) {
            await injectRound(r);

            // Wait for queue to drain before next round? 
            // OR just blast them? The user wants STRESS.
            // Let's wait 5 seconds to simulate reading time, but not full drain.
            // Realistically, if we blast 50 messages, the queue might back up.
            // Let's give it 10 seconds between rounds to mimic rapid chat.
            await new Promise(res => setTimeout(res, 8000));
        }

        console.log("[Main] All rounds injected. Waiting for workers to finish (idle)...");
        await Promise.all(workerPromises);

        await verify();

    } catch (e) {
        console.error('Fatal Test Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
