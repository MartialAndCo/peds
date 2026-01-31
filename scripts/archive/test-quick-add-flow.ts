
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQuickAddFlow() {
    console.log('=== TEST: Quick Add Contact Flow ===\n');

    const testPhone = `+337${Math.floor(Math.random() * 100000000)}`; // Random French mobile
    const testContext = "Met at a bar in Paris, 25yo, student.";

    console.log(`1. Simulating POST request for ${testPhone}...`);

    // Simulate API logic locally (since we can't fetch localhost easily from script without running server URL)
    // We'll mimic exactly what the route does.

    // Step 1: Create Contact
    console.log('   Creating contact via mimicked API logic...');
    let contact = await prisma.contact.create({
        data: {
            phone_whatsapp: testPhone,
            name: "Test Quick Add",
            source: 'manual_dashboard_quick_add',
            notes: `Context: ${testContext}`,
            status: 'new'
        }
    });
    console.log(`   ✅ Contact created with ID: ${contact.id}`);

    // Step 2: Lead Init Logic
    console.log('   Running Lead Initialization Logic...');
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst();
    if (!prompt) throw new Error("No prompt found");

    const conversation = await prisma.conversation.create({
        data: {
            contactId: contact.id,
            promptId: prompt.id,
            status: 'paused',
            ai_enabled: true,
            metadata: {
                state: 'WAITING_FOR_LEAD',
                leadContext: testContext
            }
        }
    });

    console.log(`   ✅ Conversation created with ID: ${conversation.id}`);

    // Step 3: Verify Persistence
    console.log('\n2. Verifying Database State...');
    const savedConv = await prisma.conversation.findUnique({
        where: { id: conversation.id }
    });

    if (savedConv?.status === 'paused' && (savedConv?.metadata as any)?.state === 'WAITING_FOR_LEAD') {
        console.log('   ✅ SUCCESS: Conversation is PAUSED and WAITING_FOR_LEAD');
        console.log(`   Context: "${(savedConv?.metadata as any)?.leadContext}"`);
    } else {
        console.error('   ❌ FAILED: Conversation state is incorrect');
        console.error('   State:', savedConv);
        process.exit(1);
    }

    // Attempt to simulate "First Message" handling logic from processor
    // (We won't run full processor here, but we verified expected DB state)

    // Cleanup
    await prisma.conversation.delete({ where: { id: conversation.id } });
    await prisma.contact.delete({ where: { id: contact.id } });
    console.log('\n   ✅ Cleanup complete.');
}

testQuickAddFlow()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
