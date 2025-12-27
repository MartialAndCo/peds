const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/whatsapp';
const RANDOM_NUM = Math.floor(Math.random() * 100000);
const PHONE = `33${RANDOM_NUM}`;
const ID = `${PHONE}@c.us`;

async function main() {
    console.log(`🧪 Testing SINGLE message flow for new user: ${PHONE}`);

    // 1. Send Webhook
    try {
        console.log(`1️⃣ Sending "Salut, tu es qui ?"...`);
        const res = await axios.post(WEBHOOK_URL, {
            event: 'message',
            payload: {
                id: `test_${Date.now()}`,
                from: ID,
                body: "Salut, tu es qui ?",
                fromMe: false,
                _data: { notifyName: "TestUser" },
                type: 'chat',
                timestamp: Math.floor(Date.now() / 1000)
            }
        });
        console.log(`✅ Webhook Response: ${res.status} (should be 200)`);
    } catch (e) {
        console.error(`❌ Webhook Failed: ${e.message}`);
        if (e.response) console.error(e.response.data);
        return;
    }

    // 2. Wait for AI
    console.log(`2️⃣ Waiting 10s for AI processing...`);
    await new Promise(r => setTimeout(r, 10000));

    // 3. Check DB
    console.log(`3️⃣ Checking Database...`);
    const contact = await prisma.contact.findFirst({
        where: { phone_whatsapp: { contains: String(RANDOM_NUM) } },
        include: {
            conversations: {
                include: { messages: { orderBy: { timestamp: 'asc' } } }
            }
        }
    });

    if (!contact) {
        console.error("❌ Contact NOT created.");
    } else {
        console.log(`✅ Contact Created: ${contact.phone_whatsapp}`);
        const msgs = contact.conversations[0]?.messages || [];
        console.log(`   Total Messages: ${msgs.length}`);
        msgs.forEach(m => {
            console.log(`   - [${m.sender}]: ${m.message_text.substring(0, 50)}...`);
        });

        const hasAI = msgs.some(m => m.sender === 'ai');
        if (hasAI) console.log("🎉 SUCCESS: AI Replied!");
        else console.error("❌ FAILURE: No AI Response found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
