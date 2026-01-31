import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';

const prisma = new PrismaClient();

/**
 * Test multi-agent birthday system with different base ages
 */

async function testMultiAgentBirthday() {
    console.log('=== MULTI-AGENT BIRTHDAY SYSTEM TEST ===\n');

    const settings = await settingsService.getSettings();
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } });

    if (!prompt) {
        console.error('❌ No active prompt found');
        return;
    }

    // Test scenarios with different agent ages
    const scenarios = [
        {
            name: 'Agent with base age 15',
            baseAge: 15,
            daysAgo: 7, // Birthday
            expectedAge: 16
        },
        {
            name: 'Agent with base age 22',
            baseAge: 22,
            daysAgo: 7, // Birthday
            expectedAge: 23
        },
        {
            name: 'Agent with base age 30',
            baseAge: 30,
            daysAgo: 7, // Birthday
            expectedAge: 31
        },
        {
            name: 'Agent with base age 18 (before birthday)',
            baseAge: 18,
            daysAgo: 3, // Day 3
            expectedAge: 18
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n--- ${scenario.name} ---`);

        // Create test contact
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - scenario.daysAgo);

        const testPhone = `+1555${Date.now().toString().slice(-7)}`;
        const contact = await prisma.contact.create({
            data: {
                phone_whatsapp: testPhone,
                name: 'TestUser',
                source: 'Test',
                status: 'new',
                trustScore: 50,
                agentPhase: 'CONNECTION',
                createdAt: createdAt
            }
        });

        // Mock agent settings with specific base age
        const mockSettings = {
            ...settings,
            agent_base_age: scenario.baseAge.toString()
        };

        // Build system prompt
        const { phase, details, reason } = await director.determinePhase(contact.phone_whatsapp);
        const systemPrompt = await director.buildSystemPrompt(
            mockSettings,
            contact,
            phase,
            details,
            prompt.system_prompt,
            undefined,
            reason
        );

        // Extract age from system prompt
        const ageMatch = systemPrompt.match(/Current Age: (\d+) years old/);
        const actualAge = ageMatch ? parseInt(ageMatch[1]) : null;

        console.log(`Base Age: ${scenario.baseAge}`);
        console.log(`Days since creation: ${scenario.daysAgo}`);
        console.log(`Expected age: ${scenario.expectedAge}`);
        console.log(`Actual age: ${actualAge}`);

        if (actualAge === scenario.expectedAge) {
            console.log(`✅ PASS - Age is correct`);
        } else {
            console.log(`❌ FAIL - Expected ${scenario.expectedAge}, got ${actualAge}`);
        }

        // Cleanup
        await prisma.contact.delete({ where: { id: contact.id } });
    }

    console.log('\n\n=== TEST SUMMARY ===');
    console.log('✅ Multi-agent birthday system tested');
    console.log('\nEach agent can now have their own base age:');
    console.log('  • Agent 1: base_age=15 → turns 16 on birthday');
    console.log('  • Agent 2: base_age=22 → turns 23 on birthday');
    console.log('  • Agent 3: base_age=30 → turns 31 on birthday');
}

testMultiAgentBirthday()
    .catch(e => console.error('Test failed:', e))
    .finally(async () => await prisma.$disconnect());
