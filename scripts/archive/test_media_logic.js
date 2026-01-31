const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { mediaService } = require('../lib/media');

// Mocking WhatsApp and AI libs if needed, but integration test is better.
// We assume .env is loaded.

async function test(input) {
    console.log(`\n--- Testing Input: "${input}" ---`);

    try {
        // 1. Analyze
        console.log('1. Calling analyzeRequest...');
        const analysis = await mediaService.analyzeRequest(input);

        console.log('AI Analysis Result:', JSON.stringify(analysis, null, 2));

        if (!analysis) {
            console.error('❌ Analysis returned null (AI Error or Parse Error)');
            return;
        }

        if (!analysis.isMediaRequest) {
            console.log('ℹ️ AI determined this is NOT a media request. (Normal chat)');
            return;
        }

        if (!analysis.allowed) {
            console.log(`⛔ Blocked by Blacklist/Safety. Reason: ${analysis.refusalReason}`);
            return;
        }

        if (!analysis.intentCategory) {
            console.log('⚠️ Allowed, but no matching Media Category found.');
            return;
        }

        // 2. Process
        console.log(`2. Processing Request for Category: ${analysis.intentCategory}`);

        // Mock contact phone
        const testPhone = '33612345678';

        const result = await mediaService.processRequest(testPhone, analysis.intentCategory);
        console.log('Process Result:', JSON.stringify(result, null, 2));

        if (result.action === 'SEND') {
            console.log('✅ SUCCESS: System would SEND media.');
        } else if (result.action === 'REQUEST_SOURCE') {
            console.log('✅ SUCCESS: System would REQUEST from Source (Bank empty or user saw all).');
        } else {
            console.log('❓ Unknown Action');
        }

    } catch (e) {
        console.error('❌ CRITICAL ERROR:', e);
    }
}

async function main() {
    // Check Media Types first
    const types = await prisma.mediaType.findMany();
    console.log('Available Media Types in DB:', types.map(t => t.id).join(', '));

    console.log('\n--- STARTING TESTS ---');

    // Test 1: Explicit Request (Should work)
    await test("Envoie moi une photo de tes pieds stp");

    // Test 2: Safe Chat (Should be isMediaRequest: false)
    await test("Salut ça va ?");

    // Test 3: Blacklist (IF we have a rule)
    // Let's verify blacklist rules first
    const rules = await prisma.blacklistRule.findMany();
    console.log('\nActive Blacklist Rules:', rules);
    if (rules.length > 0) {
        await test(`Je veux voir ${rules[0].term}`);
    }

    await prisma.$disconnect();
}

main();
