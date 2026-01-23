/**
 * Script to set Lena's age to 15 and test the birthday system
 */

import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';

const prisma = new PrismaClient();

async function setLenaAgeTo15AndTest() {
    console.log('=== SETTING LENA TO 15 YEARS OLD & TESTING ===\n');

    // 1. Find Lena (Agent 1)
    const lena = await prisma.agent.findFirst({
        where: { id: 1 }
    });

    if (!lena) {
        console.error('❌ Agent 1 (Lena) not found');
        return;
    }

    console.log(`Found Agent: ${lena.name} (ID: ${lena.id})\n`);

    // 2. Set Lena's base age to 15
    await prisma.agentSetting.upsert({
        where: {
            agentId_key: {
                agentId: lena.id,
                key: 'agent_base_age'
            }
        },
        update: { value: '15' },
        create: {
            agentId: lena.id,
            key: 'agent_base_age',
            value: '15'
        }
    });

    console.log('✅ Set Lena\'s base age to 15\n');

    // 3. Get settings and prompt
    const settings = await settingsService.getSettings();
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } });

    if (!prompt) {
        console.error('❌ No active prompt found');
        return;
    }

    // 4. Test Scenario 1: Day 0 (just met)
    console.log('--- Test 1: Day 0 (Just met Lena) ---');
    const day0Contact = await prisma.contact.create({
        data: {
            phone_whatsapp: `+1555${Date.now().toString().slice(-7)}`,
            name: 'TestUser',
            source: 'Test',
            status: 'new',
            trustScore: 50,
            agentPhase: 'CONNECTION',
            createdAt: new Date() // Today
        }
    });

    // Fetch agent settings (will include agent_base_age = 15)
    const agentSettings = await prisma.agentSetting.findMany({
        where: { agentId: lena.id }
    });

    const mergedSettings = { ...settings };
    agentSettings.forEach(s => {
        mergedSettings[s.key] = s.value;
    });

    const { phase: phase0, details: details0, reason: reason0 } = await director.determinePhase(day0Contact.phone_whatsapp);
    const systemPrompt0 = await director.buildSystemPrompt(
        mergedSettings,
        day0Contact,
        phase0,
        details0,
        prompt.system_prompt,
        lena.id,
        reason0
    );

    // Extract age from prompt
    const age0Match = systemPrompt0.match(/Current Age: (\d+) years old/);
    const age0 = age0Match ? parseInt(age0Match[1]) : null;
    const birthday0Match = systemPrompt0.match(/Birthday: ([A-Za-z]+ \d+)/);
    const birthday0 = birthday0Match ? birthday0Match[1] : null;

    console.log(`Lena's age: ${age0}`);
    console.log(`Lena's birthday: ${birthday0}`);
    console.log(`Expected: 15 years old`);

    if (age0 === 15) {
        console.log('✅ PASS - Lena is 15 years old\n');
    } else {
        console.log(`❌ FAIL - Expected 15, got ${age0}\n`);
    }

    // 5. Test Scenario 2: Day 7 (birthday - 1 week after first contact)
    console.log('--- Test 2: Day 7 (Lena\'s Birthday!) ---');
    const day7Date = new Date();
    day7Date.setDate(day7Date.getDate() - 7); // Created 7 days ago

    const day7Contact = await prisma.contact.create({
        data: {
            phone_whatsapp: `+1555${Date.now().toString().slice(-7)}`,
            name: 'TestUser2',
            source: 'Test',
            status: 'new',
            trustScore: 50,
            agentPhase: 'CONNECTION',
            createdAt: day7Date
        }
    });

    const { phase: phase7, details: details7, reason: reason7 } = await director.determinePhase(day7Contact.phone_whatsapp);
    const systemPrompt7 = await director.buildSystemPrompt(
        mergedSettings,
        day7Contact,
        phase7,
        details7,
        prompt.system_prompt,
        lena.id,
        reason7
    );

    const age7Match = systemPrompt7.match(/Current Age: (\d+) years old/);
    const age7 = age7Match ? parseInt(age7Match[1]) : null;
    const birthdayContext7 = systemPrompt7.match(/\[TODAY IS YOUR BIRTHDAY\]/);

    console.log(`Lena's age: ${age7}`);
    console.log(`Birthday context: ${birthdayContext7 ? 'TODAY IS YOUR BIRTHDAY!' : 'Not birthday'}`);
    console.log(`Expected: 16 years old (birthday today)`);

    if (age7 === 16 && birthdayContext7) {
        console.log('✅ PASS - Lena turned 16 on her birthday\n');
    } else {
        console.log(`❌ FAIL - Expected 16 with birthday context, got ${age7}\n`);
    }

    // 6. Test Scenario 3: Day 10 (3 days after birthday)
    console.log('--- Test 3: Day 10 (After Birthday) ---');
    const day10Date = new Date();
    day10Date.setDate(day10Date.getDate() - 10);

    const day10Contact = await prisma.contact.create({
        data: {
            phone_whatsapp: `+1555${Date.now().toString().slice(-7)}`,
            name: 'TestUser3',
            source: 'Test',
            status: 'new',
            trustScore: 50,
            agentPhase: 'CONNECTION',
            createdAt: day10Date
        }
    });

    const { phase: phase10, details: details10, reason: reason10 } = await director.determinePhase(day10Contact.phone_whatsapp);
    const systemPrompt10 = await director.buildSystemPrompt(
        mergedSettings,
        day10Contact,
        phase10,
        details10,
        prompt.system_prompt,
        lena.id,
        reason10
    );

    const age10Match = systemPrompt10.match(/Current Age: (\d+) years old/);
    const age10 = age10Match ? parseInt(age10Match[1]) : null;

    console.log(`Lena's age: ${age10}`);
    console.log(`Expected: 16 years old (birthday passed)`);

    if (age10 === 16) {
        console.log('✅ PASS - Lena is 16 years old after birthday\n');
    } else {
        console.log(`❌ FAIL - Expected 16, got ${age10}\n`);
    }

    // Cleanup
    await prisma.contact.delete({ where: { id: day0Contact.id } });
    await prisma.contact.delete({ where: { id: day7Contact.id } });
    await prisma.contact.delete({ where: { id: day10Contact.id } });

    // 7. Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Agent: ${lena.name}`);
    console.log(`Base Age: 15`);
    console.log('\nTest Results:');
    console.log(`  Day 0 (Just met): ${age0 === 15 ? '✅' : '❌'} Age ${age0}`);
    console.log(`  Day 7 (Birthday): ${age7 === 16 && birthdayContext7 ? '✅' : '❌'} Age ${age7}`);
    console.log(`  Day 10 (After): ${age10 === 16 ? '✅' : '❌'} Age ${age10}`);

    const allPassed = age0 === 15 && age7 === 16 && age10 === 16 && birthdayContext7;

    if (allPassed) {
        console.log('\n✅ ALL TESTS PASSED - Lena\'s birthday system works perfectly!');
    } else {
        console.log('\n❌ SOME TESTS FAILED - Check results above');
    }
}

setLenaAgeTo15AndTest()
    .catch(e => {
        console.error('❌ Test failed:', e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
