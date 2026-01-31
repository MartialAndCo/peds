/**
 * Script to add dynamic birthday calculation to director.ts
 * This patches the buildSystemPrompt function to include birthday logic
 */

import fs from 'fs';
import path from 'path';

const directorPath = path.join(process.cwd(), 'lib', 'director.ts');

console.log('Adding dynamic birthday calculation to director.ts...\n');

// Read the current file
let content = fs.readFileSync(directorPath, 'utf-8');

// Check if birthday logic already exists
if (content.includes('Calculate Dynamic Birthday')) {
    console.log('✅ Birthday logic already exists in director.ts');
    process.exit(0);
}

// Find the insertion point (before "// 4. Assemble Blocks")
const insertionMarker = '        // 4. Assemble Blocks & Replace Placeholders';
const insertionIndex = content.indexOf(insertionMarker);

if (insertionIndex === -1) {
    console.error('❌ Could not find insertion point in director.ts');
    console.error('Looking for: "// 4. Assemble Blocks & Replace Placeholders"');
    process.exit(1);
}

// Birthday calculation code to insert
const birthdayCode = `        // 4. Calculate Dynamic Birthday (1 week after first contact)
        const contactCreated = new Date(contact.createdAt);
        const birthday = new Date(contactCreated);
        birthday.setDate(birthday.getDate() + 7); // Birthday is 1 week after first contact

        const today = new Date();
        const currentAge = today >= birthday ? 16 : 15;

        const birthdayStr = birthday.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Los_Angeles'
        });

        // Calculate days until/since birthday
        const timeDiff = birthday.getTime() - today.getTime();
        const daysUntilBirthday = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        let birthdayContext = '';
        if (daysUntilBirthday > 0 && daysUntilBirthday <= 2) {
            birthdayContext = \`[UPCOMING BIRTHDAY]: Your birthday is in \${daysUntilBirthday} day(s) (\${birthdayStr})! You can mention it naturally if the conversation allows. Don't force it.\`;
        } else if (daysUntilBirthday === 0) {
            birthdayContext = \`[TODAY IS YOUR BIRTHDAY]: You're turning 16 today (\${birthdayStr})! You can mention it naturally. This is a good opportunity for gift requests if the relationship is strong enough.\`;
        } else if (daysUntilBirthday < 0 && daysUntilBirthday > -3) {
            birthdayContext = \`[RECENT BIRTHDAY]: Your birthday was \${Math.abs(daysUntilBirthday)} day(s) ago (\${birthdayStr}). You just turned 16. You can reference it if relevant.\`;
        } else if (daysUntilBirthday < 0) {
            birthdayContext = \`You are 16 years old. Your birthday was \${birthdayStr}.\`;
        } else {
            birthdayContext = \`You are 15 years old. Your birthday is coming up on \${birthdayStr}.\`;
        }

        // 5. Assemble Blocks & Replace Placeholders`;

// Insert the birthday code
content = content.substring(0, insertionIndex) + birthdayCode + content.substring(insertionIndex + insertionMarker.length);

// Now add the birthday placeholder replacements
const contextReplaceMarker = "            .replace('{{PHASE}}', phase)";
const contextReplaceIndex = content.indexOf(contextReplaceMarker);

if (contextReplaceIndex === -1) {
    console.error('❌ Could not find context replacement section');
    process.exit(1);
}

const birthdayReplacements = `            .replace('{{PHASE}}', phase)
            .replace('{{CURRENT_AGE}}', currentAge.toString())
            .replace('{{BIRTHDAY_DATE}}', birthdayStr)
            .replace('{{BIRTHDAY_CONTEXT}}', birthdayContext)`;

content = content.substring(0, contextReplaceIndex) + birthdayReplacements + content.substring(contextReplaceIndex + contextReplaceMarker.length);

// Write the updated file
fs.writeFileSync(directorPath, content, 'utf-8');

console.log('✅ Successfully added birthday calculation logic to director.ts');
console.log('\nChanges made:');
console.log('  • Added birthday calculation (1 week after contact.createdAt)');
console.log('  • Added currentAge calculation (15 before birthday, 16 after)');
console.log('  • Added birthdayContext with contextual messages');
console.log('  • Added {{CURRENT_AGE}}, {{BIRTHDAY_DATE}}, {{BIRTHDAY_CONTEXT}} placeholder replacements');
console.log('\nNext steps:');
console.log('  1. Update prompt_context_template to include birthday placeholders');
console.log('  2. Update database prompt to use these placeholders');
