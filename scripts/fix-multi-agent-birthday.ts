/**
 * Script to fix director.ts birthday logic for multi-agent support
 * Replaces hardcoded ages (15/16) with dynamic agent_base_age setting
 */

import fs from 'fs';
import path from 'path';

const directorPath = path.join(process.cwd(), 'lib', 'director.ts');

console.log('Fixing birthday logic for multi-agent support...\n');

let content = fs.readFileSync(directorPath, 'utf-8');

// Check if already fixed
if (content.includes('agent_base_age')) {
    console.log('✅ Birthday logic already supports multi-agent');
    process.exit(0);
}

// Replace hardcoded age calculation
const oldAgeCalc = '        const currentAge = today >= birthday ? 16 : 15;';
const newAgeCalc = `        // Get agent's base age from settings (supports multi-agent)
        const baseAge = parseInt(mergedSettings.agent_base_age || '18'); // Default 18 if not set
        const currentAge = today >= birthday ? baseAge + 1 : baseAge;`;

if (!content.includes(oldAgeCalc)) {
    console.error('❌ Could not find age calculation line to replace');
    console.error('Expected:', oldAgeCalc);
    process.exit(1);
}

content = content.replace(oldAgeCalc, newAgeCalc);

// Replace hardcoded ages in birthday context messages - use string replacements
content = content.replace(
    "You're turning 16 today",
    "You're turning ${baseAge + 1} today"
);

content = content.replace(
    'You just turned 16.',
    'You just turned ${baseAge + 1}.'
);

content = content.replace(
    'You are 16 years old.',
    'You are ${baseAge + 1} years old.'
);

content = content.replace(
    'You are 15 years old.',
    'You are ${baseAge} years old.'
);

fs.writeFileSync(directorPath, content, 'utf-8');

console.log('✅ Successfully updated director.ts for multi-agent support');
console.log('\nChanges made:');
console.log('  • Replaced hardcoded age (15/16) with dynamic agent_base_age setting');
console.log('  • Birthday context now uses ${baseAge} and ${baseAge+1}');
console.log('  • Default age is 18 if agent_base_age not set');
console.log('\nNext steps:');
console.log('  1. Add agent_base_age setting to each agent');
console.log('  2. Test with different agent ages');
