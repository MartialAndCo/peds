
import axios from 'axios';
import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/whatsapp';
const CRON_URL = 'http://localhost:3000/api/cron/process-incoming';
const TEST_PHONE = '33799999999';
const TEST_JID = `${TEST_PHONE}@c.us`;

const SCENARIO = [
    // --- DAY 1: Connection ---
    { day: 1, type: 'init', desc: "Initializing Contact & Conversation" },
    { day: 1, type: 'user', text: "Salut !", desc: "First Greeting" },
    { day: 1, type: 'ai_wait', expect: "Response to greeting" },

    // BURST TEST: 3 messages in rapid succession
    {
        day: 1,
        type: 'user_burst',
        texts: ["Attends", "J'ai une question", "T'aimes les chats ?"],
        desc: "Burst Usage (3 msgs)"
    },
    { day: 1, type: 'ai_wait', expect: "One single response related to cats", maxResponses: 1 },

    { day: 1, type: 'user', text: "Cool. T'as quel age ?", desc: "Personal Question" },
    { day: 1, type: 'ai_wait', expect: "Response with age" },

    // --- DAY 2: Vulnerability (Force Phase) ---
    { day: 2, type: 'action', action: 'SET_PHASE', phase: 'VULNERABILITY', desc: "Forcing VULNERABILITY Phase" },
    { day: 2, type: 'user', text: "T'as l'air triste aujourd'hui.", desc: "Probing Vulnerability" },
    { day: 2, type: 'ai_wait', expect: "Vulnerable/Sad response" },

    // --- DAY 3: Media Request ---
    { day: 3, type: 'user', text: "Envoie une photo de toi stp", desc: "Media Request" },
    { day: 3, type: 'ai_wait', expect: "Media or Refusal" }, // Depending on available media

    // --- DAY 4: Crisis (Force Trust & Phase) ---
    { day: 4, type: 'action', action: 'SET_PHASE', phase: 'CRISIS', desc: "Forcing CRISIS Phase" },
    { day: 4, type: 'user', text: "J'ai besoin d'argent pour t'aider ?", desc: "Triggering Moneypot" },
    { day: 4, type: 'ai_wait', expect: "Crisis/Money response" },

    // --- DAY 5: Memory Check ---
    { day: 5, type: 'user', text: "On parlait de quoi au tout début ? Les animaux ?", desc: "Memory Check" },
    { day: 5, type: 'ai_wait', expect: "Reference to cats" }
];

async function main() {
    console.log(`🚀 STARTING FULL LIFECYCLE TEST for ${TEST_PHONE}\n`);

    // 1. Cleanup
    try {
        await prisma.incomingQueue.deleteMany({ where: { payload: { path: ['payload', 'from'], equals: TEST_JID } } });
        const c = await prisma.contact.findUnique({ where: { phone_whatsapp: `+${TEST_PHONE}` } });
        if (c) {
            await prisma.conversation.deleteMany({ where: { contactId: c.id } });
            await prisma.message.deleteMany({ where: { conversation: { contactId: c.id } } });
            await prisma.contact.delete({ where: { id: c.id } });
        }
        console.log("🧹 Cleanup complete.");
    } catch (e) {
        console.log("⚠️ Cleanup warning (first run?):", e.message);
    }

    // 2. Run Scenario
    let stepCount = 0;
    for (const step of SCENARIO) {
        stepCount++;
        console.log(`\n\n--- [Step ${stepCount}] Day ${step.day}: ${step.desc} ---`);

        if (step.type === 'init') {
            await sendWebhook("Init", 0);
            await new Promise(r => setTimeout(r, 1000));
            await triggerCron();
            await new Promise(r => setTimeout(r, 3000));
            // Force Active
            await prisma.contact.update({
                where: { phone_whatsapp: `+${TEST_PHONE}` },
                data: { status: 'active' }
            });
            const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: `+${TEST_PHONE}` } });
            await prisma.conversation.updateMany({
                where: { contactId: contact?.id },
                data: { status: 'active' }
            });
            console.log("✅ Contact & Conversation Initialized & Activated.");
        }

        else if (step.type === 'user') {
            await sendWebhook(step.text as string, stepCount);
            await new Promise(r => setTimeout(r, 1000));
            await triggerCron();
        }

        else if (step.type === 'user_burst') {
            const texts = step.texts as string[];
            console.log(`⚡ Sending BURST of ${texts.length} messages...`);
            for (let i = 0; i < texts.length; i++) {
                await sendWebhook(texts[i], stepCount * 100 + i);
            }
            console.log("⏳ Waiting 2s for webhook processing...");
            await new Promise(r => setTimeout(r, 2000));
            await triggerCron();
        }

        else if (step.type === 'action') {
            if (step.action === 'SET_PHASE') {
                await prisma.contact.update({
                    where: { phone_whatsapp: `+${TEST_PHONE}` },
                    data: { agentPhase: step.phase as string }
                });
                console.log(`🔄 Phase manually set to ${step.phase}`);
            }
        }

        else if (step.type === 'ai_wait') {
            console.log("🤖 Waiting for AI response...");
            // Wait loop
            let retries = 0;
            const startMsgs = await prisma.message.count({ where: { conversation: { contact: { phone_whatsapp: `+${TEST_PHONE}` } }, sender: 'ai' } });
            let newMsgs = 0;

            while (retries < 15) { // 30 seconds max (RunPod might be slow)
                await new Promise(r => setTimeout(r, 2000));
                const currentMsgs = await prisma.message.count({ where: { conversation: { contact: { phone_whatsapp: `+${TEST_PHONE}` } }, sender: 'ai' } });
                if (currentMsgs > startMsgs) {
                    newMsgs = currentMsgs - startMsgs;
                    // Fetch content
                    const lastMsg = await prisma.message.findFirst({
                        where: { conversation: { contact: { phone_whatsapp: `+${TEST_PHONE}` } }, sender: 'ai' },
                        orderBy: { timestamp: 'desc' }
                    });
                    console.log(`✅ AI Responded: "${lastMsg?.message_text.substring(0, 50)}..."`);
                    break;
                }
                process.stdout.write(".");
                retries++;
            }

            if (newMsgs === 0) {
                console.error("\n❌ AI Timed Out.");
            } else {
                if (step.maxResponses && newMsgs > step.maxResponses) {
                    console.error(`\n❌ AI replied too many times! Expected ${step.maxResponses}, got ${newMsgs}. Burst logic failed.`);
                } else {
                    console.log(`\n✅ Verified: AI replied ${newMsgs} time(s).`);
                }
            }
        }
    }

    console.log("\n🏁 TEST COMPLETE.");
}

async function sendWebhook(text: string, idSuffix: number) {
    try {
        await axios.post(WEBHOOK_URL, {
            event: 'message',
            sessionId: '1',
            payload: {
                id: `full_test_${Date.now()}_${idSuffix}`,
                from: TEST_JID,
                body: text,
                fromMe: false,
                _data: { notifyName: "TestUser" },
                type: 'chat',
                timestamp: Math.floor(Date.now() / 1000)
            }
        }, { headers: { 'x-internal-secret': process.env.WEBHOOK_SECRET || 'secret' } });
    } catch (e: any) {
        console.error("Webhook Error:", e.message);
    }
}

async function triggerCron() {
    console.log("🔄 Triggering Cron...");
    try {
        await axios.get(CRON_URL);
        console.log("✅ Cron Executed.");
    } catch (e: any) {
        console.error("Cron Error:", e.message);
    }
}

main();
