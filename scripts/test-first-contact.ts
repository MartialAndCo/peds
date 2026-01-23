import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';

const prisma = new PrismaClient();

/**
 * Test script to verify that the AI handles first contact naturally
 * without mentioning relationship context, timeframes, or meta-information.
 */

const FIRST_CONTACT_SCENARIOS = [
    {
        name: "Simple Hey",
        userMessage: "Hey",
        expectedBehavior: "Short response (< 10 words), mirrors energy, no info dump"
    },
    {
        name: "How are you",
        userMessage: "How are you?",
        expectedBehavior: "Brief response (< 15 words), natural, no self-introduction"
    },
    {
        name: "What's up",
        userMessage: "What's up?",
        expectedBehavior: "Casual brief response, no explanation of communication style"
    },
    {
        name: "Casual greeting in French",
        userMessage: "Salut ça va?",
        expectedBehavior: "French response, short, natural"
    }
];

const FORBIDDEN_PATTERNS = [
    "weeks",
    "long-term",
    "long run",
    "no pressure",
    "take our time",
    "taking it slow",
    "building a connection",
    "getting to know each other over time",
    "we have time",
    "I have time"
];

async function testFirstContact() {
    console.log('=== FIRST CONTACT BEHAVIOR TEST ===\n');

    // Create a test contact (Days Active: 0, Trust: 0)
    const testPhone = `+1555${Date.now().toString().slice(-7)}`;

    const contact = await prisma.contact.create({
        data: {
            phone_whatsapp: testPhone,
            name: 'TestUser',
            source: 'Test',
            status: 'new',
            trustScore: 0,
            agentPhase: 'CONNECTION'
        }
    });

    console.log(`Created test contact: ${contact.phone_whatsapp}\n`);

    const settings = await settingsService.getSettings();
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } });

    if (!prompt) {
        console.error('❌ No active prompt found');
        return;
    }

    const results: any[] = [];

    for (const scenario of FIRST_CONTACT_SCENARIOS) {
        console.log(`\n--- Scenario: ${scenario.name} ---`);
        console.log(`User: "${scenario.userMessage}"`);
        console.log(`Expected: ${scenario.expectedBehavior}\n`);

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

        // Generate AI response
        const { venice } = require('../lib/venice');
        const aiResponse = await venice.chatCompletion(
            systemPrompt,
            [], // Empty history (first contact)
            scenario.userMessage,
            {
                apiKey: settings.venice_api_key,
                model: settings.venice_model || 'venice-uncensored',
                max_tokens: 100
            }
        );

        const cleanResponse = aiResponse.trim();
        const wordCount = cleanResponse.split(/\s+/).length;

        // Check for forbidden patterns
        const foundForbidden = FORBIDDEN_PATTERNS.filter(pattern =>
            cleanResponse.toLowerCase().includes(pattern.toLowerCase())
        );

        const passed = foundForbidden.length === 0 && wordCount <= 20;

        console.log(`AI Response: "${cleanResponse}"`);
        console.log(`Word Count: ${wordCount}`);

        if (foundForbidden.length > 0) {
            console.log(`❌ FAIL - Found forbidden patterns: ${foundForbidden.join(', ')}`);
        } else if (wordCount > 20) {
            console.log(`⚠️  WARNING - Response too long (${wordCount} words, expected ≤ 20)`);
        } else {
            console.log(`✅ PASS - Natural, concise response`);
        }

        results.push({
            scenario: scenario.name,
            userMessage: scenario.userMessage,
            aiResponse: cleanResponse,
            wordCount,
            forbiddenPatterns: foundForbidden,
            passed
        });
    }

    // Summary
    console.log('\n\n=== SUMMARY ===');
    const passedCount = results.filter(r => r.passed).length;
    console.log(`Passed: ${passedCount}/${results.length}`);

    if (passedCount === results.length) {
        console.log('✅ ALL TESTS PASSED - AI handles first contact naturally');
    } else {
        console.log('❌ SOME TESTS FAILED - Review responses above');
        console.log('\nFailed scenarios:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`- ${r.scenario}: ${r.forbiddenPatterns.length > 0 ? 'Forbidden patterns: ' + r.forbiddenPatterns.join(', ') : 'Too long'}`);
        });
    }

    // Cleanup
    await prisma.contact.delete({ where: { id: contact.id } });
    console.log(`\nCleaned up test contact.`);
}

testFirstContact()
    .catch(e => console.error('Test failed:', e))
    .finally(async () => await prisma.$disconnect());
