import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Diagnostic script to fetch and analyze current prompts and settings from database
 */

async function analyzeDatabasePrompts() {
    console.log('=== DATABASE PROMPT ANALYSIS ===\n');

    // 1. Fetch all prompts
    console.log('--- PROMPTS ---');
    const prompts = await prisma.prompt.findMany({
        orderBy: { id: 'asc' }
    });

    console.log(`Found ${prompts.length} prompts in database:\n`);

    prompts.forEach((prompt, index) => {
        console.log(`[${index + 1}] Prompt ID: ${prompt.id}`);
        console.log(`    Name: ${prompt.name}`);
        console.log(`    Active: ${prompt.isActive ? '✅ YES' : '❌ NO'}`);
        console.log(`    Model: ${prompt.model}`);
        console.log(`    Description: ${prompt.description || 'N/A'}`);
        console.log(`    System Prompt Length: ${prompt.system_prompt?.length || 0} chars`);

        // Check for age references
        const ageMatches = prompt.system_prompt?.match(/(\d+)\s*years?\s*old/gi) || [];
        if (ageMatches.length > 0) {
            console.log(`    ⚠️  AGE REFERENCES FOUND: ${ageMatches.join(', ')}`);
        }

        // Check for name references
        const nameMatches = prompt.system_prompt?.match(/You are (\w+)/gi) || [];
        if (nameMatches.length > 0) {
            console.log(`    👤 NAME REFERENCES: ${nameMatches.join(', ')}`);
        }

        // Check for birthday references
        const birthdayMatches = prompt.system_prompt?.match(/birthday/gi) || [];
        if (birthdayMatches.length > 0) {
            console.log(`    🎂 BIRTHDAY MENTIONS: ${birthdayMatches.length} times`);
        }

        console.log('');
    });

    // 2. Show active prompt in detail
    const activePrompt = prompts.find(p => p.isActive);
    if (activePrompt) {
        console.log('\n--- ACTIVE PROMPT DETAILS ---');
        console.log(`ID: ${activePrompt.id}`);
        console.log(`Name: ${activePrompt.name}`);
        console.log('\nFirst 500 characters of system_prompt:');
        console.log('---');
        console.log(activePrompt.system_prompt?.substring(0, 500) || 'N/A');
        console.log('---\n');
    } else {
        console.log('⚠️  NO ACTIVE PROMPT FOUND!\n');
    }

    // 3. Fetch relevant settings
    console.log('\n--- RELEVANT SETTINGS ---');
    const settingKeys = [
        'prompt_identity_template',
        'prompt_context_template',
        'prompt_mission_template',
        'prompt_global_rules'
    ];

    for (const key of settingKeys) {
        const setting = await prisma.setting.findUnique({ where: { key } });
        if (setting) {
            console.log(`\n${key}:`);
            console.log('---');
            console.log(setting.value);
            console.log('---');
        } else {
            console.log(`\n${key}: NOT FOUND`);
        }
    }

    // 4. Analysis Summary
    console.log('\n\n=== ANALYSIS SUMMARY ===');

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!activePrompt) {
        issues.push('❌ No active prompt found');
        recommendations.push('Create or activate a prompt');
    }

    if (activePrompt) {
        const hasHardcodedAge = /(\d+)\s*years?\s*old/i.test(activePrompt.system_prompt || '');
        if (hasHardcodedAge) {
            issues.push('❌ Active prompt contains hardcoded age');
            recommendations.push('Remove hardcoded age and use dynamic {{CURRENT_AGE}} placeholder');
        }

        const hasJulien = /julien/i.test(activePrompt.system_prompt || '');
        if (hasJulien) {
            issues.push('⚠️  Active prompt references "Julien" persona');
            recommendations.push('Update persona to match your agent character');
        }

        const hasBirthdayPlaceholder = /\{\{BIRTHDAY/i.test(activePrompt.system_prompt || '');
        if (!hasBirthdayPlaceholder) {
            issues.push('ℹ️  No birthday placeholder found in active prompt');
            recommendations.push('Add {{CURRENT_AGE}}, {{BIRTHDAY_DATE}}, {{BIRTHDAY_CONTEXT}} placeholders');
        }
    }

    if (issues.length > 0) {
        console.log('\nIssues Found:');
        issues.forEach(issue => console.log(`  ${issue}`));
    } else {
        console.log('\n✅ No issues found');
    }

    if (recommendations.length > 0) {
        console.log('\nRecommendations:');
        recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    console.log('\n');

    return {
        prompts,
        activePrompt,
        issues,
        recommendations
    };
}

analyzeDatabasePrompts()
    .then(result => {
        console.log('Analysis complete. Ready to implement dynamic birthday system.');
        process.exit(0);
    })
    .catch(e => {
        console.error('Analysis failed:', e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
