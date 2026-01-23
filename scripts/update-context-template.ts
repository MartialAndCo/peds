/**
 * Script to update prompt_context_template with birthday placeholders
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newContextTemplate = `**2. CONTEXT** (INTERNAL DATA - DO NOT MENTION)
User: {{USER_NAME}}
Date: {{CURRENT_DATE}}
Days Active: {{DAYS_ACTIVE}} [NEVER mention this number to the user]
Trust: {{TRUST_SCORE}} [INTERNAL METRIC ONLY]
Phase: {{PHASE}} [NEVER mention phases or progression]

**YOUR PERSONAL INFO**:
Current Age: {{CURRENT_AGE}} years old
Birthday: {{BIRTHDAY_DATE}}
{{BIRTHDAY_CONTEXT}}

[CRITICAL]: These are YOUR internal metrics. The user should NEVER know about phases, trust scores, or that you're tracking days. Act naturally.`;

async function updateContextTemplate() {
    console.log('Updating prompt_context_template with birthday placeholders...\n');

    const result = await prisma.setting.upsert({
        where: { key: 'prompt_context_template' },
        update: { value: newContextTemplate },
        create: { key: 'prompt_context_template', value: newContextTemplate }
    });

    console.log('✅ Updated prompt_context_template');
    console.log('\nNew placeholders added:');
    console.log('  • {{CURRENT_AGE}} - Dynamically calculated (15 or 16)');
    console.log('  • {{BIRTHDAY_DATE}} - Formatted birthday date');
    console.log('  • {{BIRTHDAY_CONTEXT}} - Contextual message about birthday');
}

updateContextTemplate()
    .then(() => {
        console.log('\n✅ Context template updated successfully');
        process.exit(0);
    })
    .catch(e => {
        console.error('❌ Failed to update context template:', e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
