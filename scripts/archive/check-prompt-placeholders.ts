/**
 * Script to check and display the current active prompt
 * to see what's wrong with the birthday placeholders
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPrompt() {
    console.log('=== CHECKING ACTIVE PROMPT ===\n');

    const activePrompt = await prisma.prompt.findFirst({
        where: { isActive: true }
    });

    if (!activePrompt) {
        console.error('❌ No active prompt found');
        return;
    }

    console.log(`Prompt ID: ${activePrompt.id}`);
    console.log(`Name: ${activePrompt.name}\n`);

    // Check for placeholders
    const hasCurrentAge = activePrompt.system_prompt?.includes('{{CURRENT_AGE}}');
    const hasBirthdayDate = activePrompt.system_prompt?.includes('{{BIRTHDAY_DATE}}');
    const hasBirthdayContext = activePrompt.system_prompt?.includes('{{BIRTHDAY_CONTEXT}}');

    console.log('Placeholder Check:');
    console.log(`  {{CURRENT_AGE}}: ${hasCurrentAge ? '✅ Found' : '❌ Missing'}`);
    console.log(`  {{BIRTHDAY_DATE}}: ${hasBirthdayDate ? '✅ Found' : '❌ Missing'}`);
    console.log(`  {{BIRTHDAY_CONTEXT}}: ${hasBirthdayContext ? '✅ Found' : '❌ Missing'}`);

    // Check for hardcoded ages
    const has15 = /15.year.old/i.test(activePrompt.system_prompt || '');
    const has16 = /16.year.old/i.test(activePrompt.system_prompt || '');

    console.log('\nHardcoded Age Check:');
    console.log(`  "15 year old": ${has15 ? '⚠️  Found (should be removed)' : '✅ Not found'}`);
    console.log(`  "16 year old": ${has16 ? '⚠️  Found (should be removed)' : '✅ Not found'}`);

    // Show first 1000 characters
    console.log('\nFirst 1000 characters of prompt:');
    console.log('---');
    console.log(activePrompt.system_prompt?.substring(0, 1000) || 'N/A');
    console.log('---');

    // Check context template
    console.log('\n=== CHECKING CONTEXT TEMPLATE ===\n');
    const contextTemplate = await prisma.setting.findUnique({
        where: { key: 'prompt_context_template' }
    });

    if (contextTemplate) {
        console.log('Context Template:');
        console.log('---');
        console.log(contextTemplate.value);
        console.log('---');
    } else {
        console.log('❌ Context template not found');
    }
}

checkPrompt()
    .catch(e => console.error('Error:', e))
    .finally(async () => await prisma.$disconnect());
