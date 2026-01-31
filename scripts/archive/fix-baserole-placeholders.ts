/**
 * Script to add placeholder replacement for baseRole in director.ts
 */

import fs from 'fs';
import path from 'path';

const directorPath = path.join(process.cwd(), 'lib', 'director.ts');

console.log('Adding placeholder replacement for baseRole...\n');

let content = fs.readFileSync(directorPath, 'utf-8');

// Check if already fixed
if (content.includes('Replace placeholders in baseRole')) {
    console.log('✅ baseRole placeholder replacement already exists');
    process.exit(0);
}

// Find where pIdentity is defined
const insertionPoint = "        const pIdentity = tIdentity.replace('{{ROLE}}', baseRole)";
const insertionIndex = content.indexOf(insertionPoint);

if (insertionIndex === -1) {
    console.error('❌ Could not find insertion point');
    process.exit(1);
}

// Add baseRole placeholder replacement BEFORE pIdentity
const newCode = `        // Replace placeholders in baseRole (prompt.system_prompt)
        const processedBaseRole = baseRole
            .replace(/\\{\\{CURRENT_AGE\\}\\}/g, currentAge.toString())
            .replace(/\\{\\{BIRTHDAY_DATE\\}\\}/g, birthdayStr)
            .replace(/\\{\\{BIRTHDAY_CONTEXT\\}\\}/g, birthdayContext);

        const pIdentity = tIdentity.replace('{{ROLE}}', processedBaseRole)`;

content = content.substring(0, insertionIndex) + newCode + content.substring(insertionIndex + insertionPoint.length);

fs.writeFileSync(directorPath, content, 'utf-8');

console.log('✅ Successfully added baseRole placeholder replacement');
console.log('\nChanges made:');
console.log('  • baseRole now has {{CURRENT_AGE}}, {{BIRTHDAY_DATE}}, {{BIRTHDAY_CONTEXT}} replaced');
console.log('  • This ensures placeholders in prompt.system_prompt are replaced');
