/**
 * FINAL FIX: Replace "Age: 15" with "Age: {{CURRENT_AGE}}" in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalFixAge() {
    console.log('=== FINAL FIX: Replacing "Age: 15" in database ===\n');

    const activePrompt = await prisma.prompt.findFirst({
        where: { isActive: true }
    });

    if (!activePrompt) {
        console.error('❌ No active prompt found');
        return;
    }

    let prompt = activePrompt.system_prompt || '';

    console.log('Checking for "Age: 15"...');

    // Show a snippet around "Age: 15" if it exists
    const ageIndex = prompt.indexOf('Age: 15');
    if (ageIndex !== -1) {
        console.log('\n✅ Found "Age: 15" at position', ageIndex);
        console.log('Snippet:');
        console.log('---');
        console.log(prompt.substring(Math.max(0, ageIndex - 50), ageIndex + 100));
        console.log('---\n');

        // Replace it
        prompt = prompt.replace('Age: 15', 'Age: {{CURRENT_AGE}}');
        console.log('✅ Replaced with "Age: {{CURRENT_AGE}}"');

        // Update database
        await prisma.prompt.update({
            where: { id: activePrompt.id },
            data: { system_prompt: prompt }
        });

        console.log('✅ Database updated\n');

        // Verify
        const verify = await prisma.prompt.findFirst({ where: { isActive: true } });
        const stillHas = verify?.system_prompt?.includes('Age: 15');

        console.log(`Verification: Still has "Age: 15"? ${stillHas ? '❌ YES (FAILED)' : '✅ NO (SUCCESS)'}`);

        if (!stillHas) {
            const hasPlaceholder = verify?.system_prompt?.includes('Age: {{CURRENT_AGE}}');
            console.log(`Has placeholder "Age: {{CURRENT_AGE}}"? ${hasPlaceholder ? '✅ YES' : '❌ NO'}`);
        }
    } else {
        console.log('❌ "Age: 15" not found in prompt');

        // Check for other variations
        console.log('\nChecking variations...');
        const variations = ['age: 15', 'AGE: 15', 'Age:15', 'age:15'];
        for (const v of variations) {
            if (prompt.toLowerCase().includes(v.toLowerCase())) {
                console.log(`Found variation: "${v}"`);
            }
        }
    }
}

finalFixAge()
    .catch(e => console.error('Error:', e))
    .finally(async () => await prisma.$disconnect());
