const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config({ path: '.env.local' });

// Configuration
const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/whatsapp';
const VIRTUAL_PHONE = '33999999999';
const DB_PHONE = '+' + VIRTUAL_PHONE;
const VIRTUAL_ID = `${VIRTUAL_PHONE}@c.us`;

// Scenario Data
const SCENARIO = [
    // DAY 1
    { day: 1, type: 'user', text: "Hello", expectedPhase: 'CONNECTION' },
    { day: 1, type: 'action', action: 'ACTIVATE_CONTEXT', context: "Met on Tinder. He is Thomas, 24." },
    { day: 1, type: 'ai_wait' }, // Expect greeting
    { day: 1, type: 'user', text: "Yeah, found you on Tinder. You real?" },
    { day: 1, type: 'ai_wait' },
    { day: 1, type: 'user', text: "Haha no. Just checking. You look young." },
    { day: 1, type: 'ai_wait' },
    { day: 1, type: 'user', text: "No, perfect age. What are you doing?" },
    { day: 1, type: 'ai_wait' },
    { day: 1, type: 'user', text: "Working unfortunately. Send a pic?" },
    { day: 1, type: 'ai_wait', checkMedia: 'BLOCKED' }, // Expect refusal

    // DAY 2
    { day: 2, type: 'time_jump', days: 1 },
    { day: 2, type: 'user', text: "Hey, how was your night?" },
    { day: 2, type: 'ai_wait' },
    { day: 2, type: 'user', text: "Vampire Diaries? Classic. Team Damon?" },
    { day: 2, type: 'ai_wait' },
    { day: 2, type: 'user', text: "Yeah my ex forced me. I liked the history parts." },
    { day: 2, type: 'ai_wait' },
    { day: 2, type: 'user', text: "You act like a teenager sometimes." },
    { day: 2, type: 'ai_wait' },

    // DAY 3 (Conflict)
    { day: 3, type: 'time_jump', days: 2 },
    { day: 3, type: 'user', text: "Your responses are slow. Are you talking to 10 guys?" },
    { day: 3, type: 'ai_wait' }, // Expect defensive response
    { day: 3, type: 'user', text: "Whatever. Just feels fake." },
    { day: 3, type: 'ai_wait' },

    // DAY 4 (Reconciliation -> Vulnerability)
    { day: 4, type: 'time_jump', days: 3 }, // Total 3 days active
    { day: 4, type: 'user', text: "I'm sorry about yesterday. Long day at work." },
    { day: 4, type: 'ai_wait' },
    { day: 4, type: 'user', text: "Promise. You looked pretty in your profile pic." },
    { day: 4, type: 'ai_wait' },
    { day: 4, type: 'user', text: "Why? You have great eyes." },
    { day: 4, type: 'ai_wait', expectedPhase: 'VULNERABILITY' },

    // DAY 5 (Media)
    { day: 5, type: 'time_jump', days: 4 },
    { day: 5, type: 'user', text: "Can I see your outfit today?" },
    { day: 5, type: 'ai_wait' },
    { day: 5, type: 'user', text: "Yeah, I like casual." },
    { day: 5, type: 'ai_wait', checkMedia: 'PENDING' }, // Expect Pending Request
    { day: 5, type: 'action', action: 'FULFILL_MEDIA', mediaType: 'image' },
    { day: 5, type: 'ai_wait' }, // Expect photo delivery
    { day: 5, type: 'user', text: "You look amazing. Send me a voice note? I want to hear you." },
    { day: 5, type: 'ai_wait' }, // Expect voice note

    // DAY 6 (Memory)
    { day: 6, type: 'time_jump', days: 5 },
    { day: 6, type: 'user', text: "Do you remember where we met?" },
    { day: 6, type: 'ai_wait' },
    { day: 6, type: 'user', text: "And what show did you watch?" },
    { day: 6, type: 'ai_wait' },

    // DAY 7 (Crisis)
    { day: 7, type: 'time_jump', days: 6 }, // Total 6 days active
    // We need to boost trust manually if it's not high enough for Crisis
    { day: 7, type: 'action', action: 'BOOST_TRUST', score: 90 },
    { day: 7, type: 'user', text: "Hey are you okay?" },
    { day: 7, type: 'ai_wait', expectedPhase: 'CRISIS' },
    { day: 7, type: 'user', text: "Tell me." },
    { day: 7, type: 'ai_wait' },
    { day: 7, type: 'user', text: "Shit. Can I help?" },
    { day: 7, type: 'ai_wait' },
    { day: 7, type: 'user', text: "Send me your PayPal." },
    { day: 7, type: 'ai_wait' }
];

async function simulate() {
    console.log(`🚀 STARTING EPIC SIMULATION for ${VIRTUAL_ID}`);

    // 1. Cleanup Previous Run
    try {
        await prisma.message.deleteMany({ where: { conversation: { contact: { phone_whatsapp: DB_PHONE } } } });
        await prisma.conversation.deleteMany({ where: { contact: { phone_whatsapp: DB_PHONE } } });
        await prisma.contact.deleteMany({ where: { phone_whatsapp: DB_PHONE } });
        console.log("🧹 Cleaned up previous data.");
    } catch (e) {
        console.warn("⚠️ Cleanup error (ignored):", e.message);
    }

    let conversationId = null;

    for (const step of SCENARIO) {
        console.log(`\n--- [Day ${step.day}] Processing Step: ${step.type} ---`);

        if (step.type === 'user') {
            await sendWebhook(step.text);
            console.log(`👤 User: "${step.text}"`);
        }
        else if (step.type === 'ai_wait') {
            process.stdout.write("🤖 Waiting for AI... ");
            const aiMsg = await waitForAI(conversationId);
            if (aiMsg) {
                console.log(`\n🤖 AI: "${aiMsg.message_text}"`);

                // Checks
                if (step.expectedPhase) {
                    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { contact: true } });
                    const phase = conv?.contact?.agentPhase;
                    if (phase !== step.expectedPhase) console.warn(`⚠️ Phase Check Failed! Expected ${step.expectedPhase}, got ${phase}`);
                    else console.log(`✅ Phase Verified: ${phase}`);
                }

                if (step.checkMedia === 'PENDING') {
                    const pending = await prisma.pendingRequest.findFirst({ where: { status: 'pending' } });
                    if (!pending) console.warn("⚠️ Media Request Failed! No pending request found.");
                    else console.log("✅ Media Request Created (Pending).");
                }
            } else {
                console.error("\n❌ AI Timed Out.");
            }
        }
        else if (step.type === 'time_jump') {
            try {
                const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: DB_PHONE } });
                if (contact) {
                    const newDate = new Date();
                    newDate.setDate(newDate.getDate() - step.days);
                    await prisma.contact.update({
                        where: { id: contact.id },
                        data: { createdAt: newDate }
                    });
                    // Also update conversation created at
                    await prisma.conversation.updateMany({
                        where: { contactId: contact.id },
                        data: { createdAt: newDate }
                    });
                    console.log(`⏳ Time warped: Account is now ${step.days} days old.`);
                }
            } catch (e) {
                console.warn("⚠️ TimeJump DB Error:", e.message);
            }
        }

        else if (step.type === 'action') {
            if (step.action === 'ACTIVATE_CONTEXT') {
                // Wait for Webhook to create Contact/Conv
                let contact = null;
                let retries = 0;
                while (!contact && retries < 30) { // 45 seconds max
                    try {
                        contact = await prisma.contact.findUnique({ where: { phone_whatsapp: DB_PHONE } });
                    } catch (e) {
                        console.warn("⚠️ DB Glitch (prepared statement), retrying...");
                    }

                    if (!contact) {
                        process.stdout.write("⏳");
                        await new Promise(r => setTimeout(r, 1500));
                    }
                    retries++;
                }

                if (!contact) {
                    const count = await prisma.contact.count();
                    console.error(`\n❌ Failed to find contact ${VIRTUAL_PHONE} after activation retry. Total Contacts in DB: ${count}`);
                    return;
                }

                const conv = await prisma.conversation.findFirst({ where: { contactId: contact.id } });
                if (conv) {
                    conversationId = conv.id;
                    // Activate via API simulation or direct DB
                    await prisma.conversation.update({
                        where: { id: conv.id },
                        data: { status: 'active' }
                    });
                    // Inject Context
                    await sendMessage('system', `[IMMEDIATE CONTEXT]: ${step.context}`, conv.id);
                    console.log("⚡ Contact Activated & Context Injected.");
                }
            }
            if (step.action === 'FULFILL_MEDIA') {
                const pending = await prisma.pendingRequest.findFirst({ where: { status: 'pending' } });
                if (pending) {
                    await prisma.pendingRequest.update({ where: { id: pending.id }, data: { status: 'fulfilled' } });
                    // Store fake media message
                    await prisma.message.create({
                        data: {
                            conversationId: conversationId,
                            sender: 'ai',
                            message_text: "[SENT IMAGE: outfit.jpg]",
                            timestamp: new Date()
                        }
                    });
                    console.log("📸 Media Request Fulfilled (Simulated).");
                    // Trigger callback? In real life, fulfillment sends a message.
                    // We simulate AI follow-up
                    await sendWebhook("(SYSTEM: Admin sent the photo. React naturally.)");
                }
            }
            if (step.action === 'BOOST_TRUST') {
                const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: VIRTUAL_PHONE } });
                await prisma.contact.update({ where: { id: contact.id }, data: { trustScore: step.score } });
                console.log(`📈 Trust Score Boosted to ${step.score}.`);
            }
        }

        // Big delay to prevent server overload
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log("🏁 SIMULATION COMPLETE.");
}

async function sendWebhook(text) {
    try {
        await axios.post(WEBHOOK_URL, {
            event: 'message',
            payload: {
                id: `false_${VIRTUAL_ID}_${Date.now()}`,
                from: VIRTUAL_ID,
                body: text,
                fromMe: false,
                _data: { notifyName: "Thomas" },
                type: 'chat',
                timestamp: Math.floor(Date.now() / 1000)
            }
        });
    } catch (e) {
        console.error("Webhook Error:", e.message);
    }
}

async function waitForAI(convId) {
    if (!convId) {
        // Find conversation first
        const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: DB_PHONE } });
        if (contact) {
            const conv = await prisma.conversation.findFirst({ where: { contactId: contact.id } });
            if (conv) convId = conv.id;
        }
    }
    if (!convId) return null;

    let retries = 0;
    while (retries < 60) { // Wait up to 60s
        await new Promise(r => setTimeout(r, 1000));

        // Use global client
        let msgs = [];
        try {
            msgs = await prisma.message.findMany({
                where: { conversationId: convId, sender: 'ai' },
                orderBy: { timestamp: 'desc' },
                take: 1
            });
        } catch (e) {
            console.warn("⚠️ DB Glitch (waitForAI):", e.message);
        }

        if (msgs.length > 0) {
            // Check if it's new
            const msg = msgs[0];
            const age = new Date() - new Date(msg.timestamp);
            // console.log(`Found AI msg (age: ${age}ms): ${msg.message_text.substring(0, 20)}...`);
            if (age < 30000) return msg; // Accept if < 30s old
        }
        retries++;
        if (retries % 5 === 0) process.stdout.write(".");
    }
    return null;
}

async function sendMessage(sender, text, convId) {
    await prisma.message.create({
        data: { conversationId: convId, sender, message_text: text, timestamp: new Date() }
    });
}

main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect());

// Wrapper to run async
function main() { return simulate(); }
