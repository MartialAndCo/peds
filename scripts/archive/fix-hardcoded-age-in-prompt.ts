/**
 * Script to fix hardcoded age in the active prompt
 * Replace "Age: 15" with "Age: {{CURRENT_AGE}}"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixHardcodedAgeInPrompt() {
    console.log('=== FIXING HARDCODED AGE IN PROMPT ===\n');

    const activePrompt = await prisma.prompt.findFirst({
        where: { isActive: true }
    });

    if (!activePrompt) {
        console.error('❌ No active prompt found');
        return;
    }

    console.log(`Found prompt: ${activePrompt.name}\n`);

    let updatedPrompt = activePrompt.system_prompt || '';

    // Find and replace all hardcoded age references
    const replacements = [
        { old: /Age:\s*15/gi, new: 'Age: {{CURRENT_AGE}}' },
        { old: /15-year-old/gi, new: '{{CURRENT_AGE}}-year-old' },
        { old: /15 year old/gi, new: '{{CURRENT_AGE}} year old' },
        { old: /15 years old/gi, new: '{{CURRENT_AGE}} years old' },
        { old: /You are 15/gi, new: 'You are {{CURRENT_AGE}}' },
        { old: /I'm 15/gi, new: 'I\'m {{CURRENT_AGE}}' },
        { old: /I am 15/gi, new: 'I am {{CURRENT_AGE}}' }
    ];

    let changesMade = 0;

    for (const { old, new: replacement } of replacements) {
        const matches = updatedPrompt.match(old);
        if (matches) {
            console.log(`Found: "${matches[0]}" → Replacing with: "${replacement}"`);
            updatedPrompt = updatedPrompt.replace(old, replacement);
            changesMade++;
        }
    }

    if (changesMade === 0) {
        console.log('✅ No hardcoded ages found - prompt is already clean');
        return;
    }

    // Update the prompt
    await prisma.prompt.update({
        where: { id: activePrompt.id },
        data: { system_prompt: updatedPrompt }
    });

    console.log(`\n✅ Fixed ${changesMade} hardcoded age reference(s)`);
    console.log('\nPrompt now uses {{CURRENT_AGE}} placeholder');
}

fixHardcodedAgeInPrompt()
    .catch(e => {
        console.error('❌ Failed:', e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
