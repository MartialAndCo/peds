/**
 * Script to manually replace "Age: 15" with "Age: {{CURRENT_AGE}}" in prompt
 * Using simple string replacement
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function manualFixAge() {
    console.log('=== MANUAL FIX: Replacing Age: 15 ===\n');

    const activePrompt = await prisma.prompt.findFirst({
        where: { isActive: true }
    });

    if (!activePrompt) {
        console.error('❌ No active prompt found');
        return;
    }

    let updatedPrompt = activePrompt.system_prompt || '';

    // Show what we're looking for
    console.log('Searching for "Age: 15" in prompt...\n');

    const hasAge15 = updatedPrompt.includes('Age: 15');
    console.log(`Found "Age: 15": ${hasAge15 ? '✅ YES' : '❌ NO'}`);

    if (!hasAge15) {
        console.log('\n⚠️  "Age: 15" not found. Checking variations...');

        // Check for variations
        const variations = [
            'Age:15',
            'Age : 15',
            'age: 15',
            'AGE: 15'
        ];

        for (const v of variations) {
            if (updatedPrompt.includes(v)) {
                console.log(`Found variation: "${v}"`);
                updatedPrompt = updatedPrompt.replace(v, 'Age: {{CURRENT_AGE}}');
                break;
            }
        }
    } else {
        // Simple replacement
        updatedPrompt = updatedPrompt.replace('Age: 15', 'Age: {{CURRENT_AGE}}');
        console.log('✅ Replaced "Age: 15" with "Age: {{CURRENT_AGE}}"');
    }

    // Update
    await prisma.prompt.update({
        where: { id: activePrompt.id },
        data: { system_prompt: updatedPrompt }
    });

    console.log('\n✅ Prompt updated');

    // Verify
    const verifyPrompt = await prisma.prompt.findFirst({
        where: { isActive: true }
    });

    const stillHasAge15 = verifyPrompt?.system_prompt?.includes('Age: 15');
    console.log(`\nVerification - Still has "Age: 15": ${stillHasAge15 ? '❌ YES (FAILED)' : '✅ NO (SUCCESS)'}`);
}

manualFixAge()
    .catch(e => console.error('Error:', e))
    .finally(async () => await prisma.$disconnect());
