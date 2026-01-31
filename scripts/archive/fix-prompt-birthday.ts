/**
 * Script to fix the active prompt in database
 * Removes "Julien 30 years old" and adds proper birthday behavior
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// This is a clean prompt that uses the birthday placeholders
const cleanPrompt = `You are a 15-year-old girl (turning {{CURRENT_AGE}} based on your birthday).

[BIRTHDAY AWARENESS]:
{{BIRTHDAY_CONTEXT}}

When your birthday is mentioned or comes up naturally:
- If it's 1-2 days away: You can mention "my birthday's coming up" casually
- On your birthday: You can say "it's my birthday today!" naturally
- After birthday: You're 16 years old
- NEVER mention the exact date you met the user
- NEVER calculate or reference "1 week after we met"

[PERSONALITY & BEHAVIOR]:
(Keep all existing personality traits, conversation style, media handling, etc.)

[CRITICAL]: Your age and birthday are calculated dynamically. You are {{CURRENT_AGE}} years old. Your birthday is {{BIRTHDAY_DATE}}.`;

async function analyzeAndFixPrompt() {
    console.log('=== FIXING ACTIVE PROMPT ===\n');

    // Get active prompt
    const activePrompt = await prisma.prompt.findFirst({
        where: { isActive: true }
    });

    if (!activePrompt) {
        console.error('❌ No active prompt found!');
        process.exit(1);
    }

    console.log(`Found active prompt: ID ${activePrompt.id}, Name: "${activePrompt.name}"\n`);

    // Check for issues
    const hasJulien = /julien/i.test(activePrompt.system_prompt || '');
    const hasHardcodedAge = /30\s*years?\s*old/i.test(activePrompt.system_prompt || '');
    const hasBirthdayPlaceholder = /\{\{BIRTHDAY/i.test(activePrompt.system_prompt || '');

    console.log('Current prompt analysis:');
    console.log(`  • Contains "Julien": ${hasJulien ? '❌ YES' : '✅ NO'}`);
    console.log(`  • Contains "30 years old": ${hasHardcodedAge ? '❌ YES' : '✅ NO'}`);
    console.log(`  • Has birthday placeholders: ${hasBirthdayPlaceholder ? '✅ YES' : '❌ NO'}`);

    if (!hasJulien && !hasHardcodedAge && hasBirthdayPlaceholder) {
        console.log('\n✅ Prompt is already clean!');
        return;
    }

    console.log('\n⚠️  Prompt needs to be updated');
    console.log('\nOptions:');
    console.log('  1. Keep existing prompt content and just add birthday section');
    console.log('  2. Replace with clean template (you\'ll need to add back personality details)');
    console.log('\nChoosing Option 1: Adding birthday section to existing prompt...\n');

    let updatedPrompt = activePrompt.system_prompt || '';

    // Remove Julien references
    if (hasJulien) {
        updatedPrompt = updatedPrompt.replace(/You are Julien,\s*30\s*years?\s*old[^.]*\./gi, 'You are a {{CURRENT_AGE}}-year-old girl.');
        updatedPrompt = updatedPrompt.replace(/Julien/g, 'You');
        console.log('  ✅ Removed "Julien" references');
    }

    // Remove hardcoded age
    if (hasHardcodedAge) {
        updatedPrompt = updatedPrompt.replace(/30\s*years?\s*old/gi, '{{CURRENT_AGE}} years old');
        console.log('  ✅ Replaced hardcoded age with {{CURRENT_AGE}}');
    }

    // Add birthday section if not present
    if (!hasBirthdayPlaceholder) {
        const birthdaySection = `\n\n[BIRTHDAY AWARENESS]:\n{{BIRTHDAY_CONTEXT}}\n\nWhen your birthday is mentioned or comes up naturally:\n- If it's 1-2 days away: You can mention "my birthday's coming up" casually\n- On your birthday: You can say "it's my birthday today!" naturally\n- After birthday: You're 16 years old\n- NEVER mention the exact date you met the user\n- NEVER calculate or reference "1 week after we met"\n\n[CRITICAL]: Your age is {{CURRENT_AGE}} years old. Your birthday is {{BIRTHDAY_DATE}}.\n`;

        // Insert at the beginning
        updatedPrompt = birthdaySection + updatedPrompt;
        console.log('  ✅ Added birthday awareness section');
    }

    // Update the prompt
    await prisma.prompt.update({
        where: { id: activePrompt.id },
        data: {
            system_prompt: updatedPrompt,
            name: activePrompt.name.replace('Julien', 'Agent').replace('30yo', '15yo')
        }
    });

    console.log('\n✅ Prompt updated successfully!');
    console.log('\nChanges made:');
    console.log('  • Removed "Julien" persona');
    console.log('  • Replaced hardcoded age with {{CURRENT_AGE}} placeholder');
    console.log('  • Added birthday awareness section with {{BIRTHDAY_CONTEXT}}');
    console.log('  • Added {{BIRTHDAY_DATE}} placeholder');
}

analyzeAndFixPrompt()
    .then(() => {
        console.log('\n✅ All done! Prompt is now using dynamic birthday system.');
        process.exit(0);
    })
    .catch(e => {
        console.error('❌ Failed:', e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
