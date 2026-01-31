const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_PHONE = '33695472237';
const NORMALIZED_PHONE = `+${TARGET_PHONE}`;

async function debug() {
    console.log(`\n--- Debugging User: ${NORMALIZED_PHONE} ---\n`);

    // 1. Find Contact
    const contact = await prisma.contact.findUnique({
        where: { phone_whatsapp: NORMALIZED_PHONE }
    });

    if (!contact) {
        console.log('❌ Contact not found!');
        return;
    }
    console.log('✅ Contact Found:', contact.id, contact.name);

    // 2. Find Active Conversation & Prompt
    const conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, status: 'active' },
        include: { prompt: true }
    });

    if (conversation) {
        console.log('\n✅ Active Conversation:', conversation.id);
        console.log('Linked Prompt ID:', conversation.promptId);
        console.log('Prompt Name:', conversation.prompt.name);

        // Check for specific instruction in system prompt
        const promptText = conversation.prompt.system_prompt;
        const hasInstruction = promptText && promptText.includes("HANDLING MEDIA REQUESTS (CRITICAL)");
        console.log('Has "media request" instruction?', hasInstruction ? '✅ YES' : '❌ NO');
        if (!hasInstruction) {
            console.log('⚠️ Current Prompt Content Preview:', promptText.substring(0, 200) + '...');
        }
    } else {
        console.log('❌ No Active Conversation found.');
    }

    // 3. Find Pending Requests
    const pendingRequests = await prisma.pendingRequest.findMany({
        where: { requesterPhone: NORMALIZED_PHONE, status: 'pending' },
        include: { type: true }
    });

    console.log(`\nPENDING REQUESTS (${pendingRequests.length}):`);
    pendingRequests.forEach(r => {
        console.log(`- ID ${r.id}: Type ${r.typeId} (${r.type.description}) since ${r.createdAt}`);
    });

    // 4. Find Last Messages
    if (conversation) {
        const messages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { timestamp: 'desc' },
            take: 5
        });
        console.log('\nLAST 5 MESSAGES:');
        messages.reverse().forEach(m => {
            console.log(`[${m.sender}] ${m.message_text}`);
        });
    }
}

debug()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
