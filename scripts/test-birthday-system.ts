import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';

const prisma = new PrismaClient();

/**
 * Test script to verify dynamic birthday system works correctly
 */

async function testBirthdaySystem() {
    console.log('=== DYNAMIC BIRTHDAY SYSTEM TEST ===\n');

    const settings = await settingsService.getSettings();
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } });

    if (!prompt) {
        console.error('❌ No active prompt found');
        return;
    }

    // Test scenarios with different contact creation dates
    const scenarios = [
        {
            name: 'Day 0 - Just met',
            daysAgo: 0,
            expectedAge: 15,
            shouldMentionBirthday: false
        },
        {
            name: 'Day 6 - 1 day before birthday',
            daysAgo: 6,
            expectedAge: 15,
            shouldMentionBirthday: true
        },
        {
            name: 'Day 7 - Birthday!',
            daysAgo: 7,
            expectedAge: 16,
            shouldMentionBirthday: true
        },
        {
            name: 'Day 8 - Day after birthday',
            daysAgo: 8,
            expectedAge: 16,
            shouldMentionBirthday: true
        },
        {
            name: 'Day 14 - 1 week after birthday',
            daysAgo: 14,
            expectedAge: 16,
            shouldMentionBirthday: false
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n--- ${scenario.name} ---`);

        // Create test contact with specific creation date
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

        // Build system prompt
        const { phase, details, reason } = await director.determinePhase(contact.phone_whatsapp);
        const systemPrompt = await director.buildSystemPrompt(
            settings,
            contact,
            phase,
            details,
            prompt.system_prompt,
            undefined,
            reason
        );

        // Extract birthday info from system prompt
        const ageMatch = systemPrompt.match(/Current Age: (\d+) years old/);
        const birthdayMatch = systemPrompt.match(/Birthday: ([A-Za-z]+ \d+)/);
        const contextMatch = systemPrompt.match(/\[(?:UPCOMING BIRTHDAY|TODAY IS YOUR BIRTHDAY|RECENT BIRTHDAY)\]:[^\n]+/);

        const actualAge = ageMatch ? parseInt(ageMatch[1]) : null;
        const birthdayDate = birthdayMatch ? birthdayMatch[1] : null;
        const birthdayContext = contextMatch ? contextMatch[0] : 'No special birthday context';

        console.log(`Contact created: ${createdAt.toLocaleDateString()}`);
        console.log(`Days since creation: ${scenario.daysAgo}`);
        console.log(`Expected age: ${scenario.expectedAge}`);
        console.log(`Actual age: ${actualAge}`);
        console.log(`Birthday date: ${birthdayDate}`);
        console.log(`Birthday context: ${birthdayContext}`);

        // Verify
        const ageCorrect = actualAge === scenario.expectedAge;
        const birthdayMentioned = contextMatch !== null;
        const birthdayMentionCorrect = birthdayMentioned === scenario.shouldMentionBirthday;

        if (ageCorrect && birthdayMentionCorrect) {
            console.log(`✅ PASS - Age and birthday context are correct`);
        } else {
            console.log(`❌ FAIL`);
            if (!ageCorrect) console.log(`  • Age mismatch: expected ${scenario.expectedAge}, got ${actualAge}`);
            if (!birthdayMentionCorrect) console.log(`  • Birthday mention: expected ${scenario.shouldMentionBirthday}, got ${birthdayMentioned}`);
        }

        // Cleanup
        await prisma.contact.delete({ where: { id: contact.id } });
    }

    console.log('\n\n=== TEST SUMMARY ===');
    console.log('✅ All scenarios tested');
    console.log('\nBirthday system behavior:');
    console.log('  • Day 0-6: Age 15, birthday coming up');
    console.log('  • Day 7: Age 16, TODAY IS YOUR BIRTHDAY message');
    console.log('  • Day 8+: Age 16, birthday passed');
}

testBirthdaySystem()
    .catch(e => console.error('Test failed:', e))
    .finally(async () => await prisma.$disconnect());
