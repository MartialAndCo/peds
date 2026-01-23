/**
 * Fix: Replace "Age: 15" in prompt_identity_template
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixIdentityTemplate() {
    console.log('=== FIXING prompt_identity_template ===\n');

    const template = await prisma.setting.findUnique({
        where: { key: 'prompt_identity_template' }
    });

    if (!template) {
        console.error('❌ prompt_identity_template not found');
        return;
    }

    let value = template.value;

    console.log('Checking for "Age: 15"...');
    const hasAge15 = value.includes('Age: 15');

    if (hasAge15) {
        console.log('✅ Found "Age: 15"');
        value = value.replace('Age: 15', 'Age: {{CURRENT_AGE}}');

        await prisma.setting.update({
            where: { key: 'prompt_identity_template' },
            data: { value }
        });

        console.log('✅ Replaced with "Age: {{CURRENT_AGE}}"');
        console.log('✅ Database updated');
    } else {
        console.log('❌ "Age: 15" not found');
    }
}

fixIdentityTemplate()
    .catch(e => console.error('Error:', e))
    .finally(async () => await prisma.$disconnect());
