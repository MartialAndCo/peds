
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock Director to avoid full import issues if environment is tricky, 
// BUT we want to test the actual director.ts logic. 
// We will try to require it. If it fails due to alias paths (@/lib), we might need to adjust or run with ts-node and tsconfig-paths.
// Assuming we run this with `npx ts-node -r tsconfig-paths/register scripts/test_trust_flow.ts`

async function main() {
    console.log("Starting Trust Flow Verification...");

    // 1. Create a Test Contact
    const testPhone = "+1234567890_TEST_" + Date.now();
    console.log(`Creating test contact: ${testPhone}`);

    const contact = await prisma.contact.create({
        data: {
            phone_whatsapp: testPhone,
            name: "Test Victim",
            trustScore: 30,
            agentPhase: 'CONNECTION',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6) // Created 6 days ago (Should trigger Slow Track to Phase B)
        }
    });

    try {
        // 2. Test Phase Determination (Time-Based Slow Track)
        // We need to import director. Since we are in scripts/, logical path is ../lib/director.ts
        // NOTE: If using ts-node with paths, @/lib should work.
        const { director } = require('../lib/director');

        console.log("Testing determinePhase (Time Force)...");
        const phaseResult = await director.determinePhase(testPhone);
        console.log("Phase Result:", phaseResult);

        if (phaseResult.phase === 'VULNERABILITY' || phaseResult.phase === 'CRISIS') {
            console.log("SUCCESS: Phase advanced based on time (Desperation Track).");
        } else {
            console.log("WARNING: Phase did not advance. Check logic.");
        }

        // 3. Test Trust Analysis (Mocking AI)
        // Create Prompt first
        const prompt = await prisma.prompt.create({
            data: {
                name: "Test Prompt",
                system_prompt: "You are a test."
            }
        });

        // Create conversation
        const conversation = await prisma.conversation.create({
            data: {
                contactId: contact.id,
                promptId: prompt.id,
                status: 'active'
            }
        });

        // We will insert some messages first
        await prisma.message.createMany({
            data: [
                { conversationId: conversation.id, sender: 'contact', message_text: "I trust you", timestamp: new Date() },
                { conversationId: conversation.id, sender: 'ai', message_text: "I am here for you", timestamp: new Date() },
                { conversationId: conversation.id, sender: 'contact', message_text: "You are my only friend", timestamp: new Date() }
            ]
        });

        // We can't easily mock the AI call inside director.ts without dependency injection or mocking library.
        // But we can run it and see if it crashes or updates the DB (even if AI fails, it logs error).
        // If real API key is present, it might actually work.
        console.log("Testing performTrustAnalysis (Real Execution)...");
        await director.performTrustAnalysis(testPhone);

        // Check TrustLog
        const logs = await prisma.trustLog.findMany({
            where: { contactId: contact.id }
        });

        if (logs.length > 0) {
            console.log("SUCCESS: TrustLog entry created:", logs[0]);
        } else {
            console.log("WARNING: No TrustLog entry created. AI might have failed or condition not met.");
        }

    } catch (e) {
        console.error("Test Failed:", e);
    } finally {
        // Cleanup
        console.log("Cleaning up...");
        await prisma.contact.delete({ where: { id: contact.id } });
        await prisma.$disconnect();
    }
}

main();
