
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// We need to access the profiler service.
// Ideally we require it.
// Note: We might need to mock the AI if we don't want to spend tokens, but for verification "Does it work?", we should try a real call if possible or mock the AI response.
// Implementing a Mock for Venice/Anthropic if needed.

async function main() {
    console.log("Starting Profiler Verification...");

    const testPhone = "+1_PROFILER_TEST_" + Date.now();

    // 1. Create Contact
    const contact = await prisma.contact.create({
        data: {
            phone_whatsapp: testPhone,
            name: "Unknown", // Should be updated
            trustScore: 10,
            agentPhase: 'CONNECTION',
        }
    });

    console.log(`Created contact: ${contact.id}`);

    // 2. Create Prompt & Conversation
    const prompt = await prisma.prompt.create({
        data: { name: "Test Prompt", system_prompt: "You are a test." }
    });

    const conversation = await prisma.conversation.create({
        data: {
            contactId: contact.id,
            status: 'active',
            promptId: prompt.id
        }
    });

    await prisma.message.createMany({
        data: [
            { conversationId: conversation.id, sender: 'contact', message_text: "Hi", timestamp: new Date() },
            { conversationId: conversation.id, sender: 'ai', message_text: "Hello! Who are you?", timestamp: new Date() },
            { conversationId: conversation.id, sender: 'contact', message_text: "I am Robert, I'm 52 years old.", timestamp: new Date() },
            { conversationId: conversation.id, sender: 'ai', message_text: "Nice to meet you Robert. What do you do?", timestamp: new Date() },
            { conversationId: conversation.id, sender: 'contact', message_text: "I am a Banker living in London.", timestamp: new Date() },
        ]
    });

    try {
        // 3. Run Profiler
        // We need to dynamically import or require logical path
        // Assuming tsx handles paths or we use relative
        const { profilerService } = require('../lib/profiler');

        console.log("Running updateProfile...");
        await profilerService.updateProfile(contact.id);

        // 4. Verify
        const updated = await prisma.contact.findUnique({
            where: { id: contact.id }
        });

        console.log("Updated Profile Data:", updated.profile);

        // Check fields
        const p = updated.profile;
        if (p && (p.name?.toLowerCase().includes('robert') || p.age == 52 || p.location?.includes('London'))) {
            console.log("SUCCESS: Profile extracted correctly.");
        } else {
            console.log("WARNING: Profile extraction might have failed or AI returned null.");
        }

    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        await prisma.contact.delete({ where: { id: contact.id } });
        await prisma.$disconnect();
    }
}

main();
