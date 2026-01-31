/**
 * Debug script to trace exactly what's happening in buildSystemPrompt
 */

import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';

const prisma = new PrismaClient();

async function debugBuildSystemPrompt() {
    console.log('=== DEBUGGING buildSystemPrompt ===\n');

    // Create test contact
    const testContact = await prisma.contact.create({
        data: {
            phone_whatsapp: `+1555${Date.now().toString().slice(-7)}`,
            name: 'DebugUser',
            source: 'Test',
            status: 'new',
            trustScore: 50,
            agentPhase: 'CONNECTION',
            createdAt: new Date()
        }
    });

    // Get settings
    const settings = await settingsService.getSettings();
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } });

    if (!prompt) {
        console.error('❌ No active prompt');
        return;
    }

    // Get agent settings for Lena
    const agentSettings = await prisma.agentSetting.findMany({
        where: { agentId: 1 }
    });

    const mergedSettings = { ...settings };
    agentSettings.forEach(s => {
        mergedSettings[s.key] = s.value;
    });

    console.log('Agent Settings:');
    agentSettings.forEach(s => {
        console.log(`  ${s.key}: ${s.value}`);
    });
    console.log('');

    // Build system prompt
    const { phase, details, reason } = await director.determinePhase(testContact.phone_whatsapp);

    console.log('Phase Details:');
    console.log(`  Phase: ${phase}`);
    console.log(`  Days Active: ${details.daysActive}`);
    console.log(`  Trust Score: ${details.trustScore}`);
    console.log('');

    const systemPrompt = await director.buildSystemPrompt(
        mergedSettings,
        testContact,
        phase,
        details,
        prompt.system_prompt,
        1, // Lena's agent ID
        reason
    );

    // Search for age in the final prompt
    console.log('Searching for age in final system prompt...\n');

    const currentAgeMatch = systemPrompt.match(/Current Age: (\d+) years old/);
    const birthdayDateMatch = systemPrompt.match(/Birthday: ([A-Za-z]+ \d+)/);
    const birthdayContextMatch = systemPrompt.match(/\[.*BIRTHDAY.*\]/);

    console.log('Found in final prompt:');
    console.log(`  Current Age: ${currentAgeMatch ? currentAgeMatch[1] : '❌ NOT FOUND'}`);
    console.log(`  Birthday Date: ${birthdayDateMatch ? birthdayDateMatch[1] : '❌ NOT FOUND'}`);
    console.log(`  Birthday Context: ${birthdayContextMatch ? '✅ Found' : '❌ NOT FOUND'}`);

    // Check if placeholders are still there (not replaced)
    const hasPlaceholder = systemPrompt.includes('{{CURRENT_AGE}}');
    console.log(`  Unreplaced {{CURRENT_AGE}}: ${hasPlaceholder ? '⚠️  YES (BUG!)' : '✅ NO'}`);

    // Show a snippet around "Current Age" if found
    if (currentAgeMatch) {
        const index = systemPrompt.indexOf('Current Age:');
        const snippet = systemPrompt.substring(Math.max(0, index - 100), index + 200);
        console.log('\nSnippet around "Current Age:":');
        console.log('---');
        console.log(snippet);
        console.log('---');
    }

    // Show first 2000 chars of final prompt
    console.log('\n\nFirst 2000 characters of FINAL system prompt:');
    console.log('===');
    console.log(systemPrompt.substring(0, 2000));
    console.log('===');

    // Cleanup
    await prisma.contact.delete({ where: { id: testContact.id } });
}

debugBuildSystemPrompt()
    .catch(e => console.error('Error:', e))
    .finally(async () => await prisma.$disconnect());
