const fs = require('fs');
const path = require('path');
const glob = require('glob');

const scriptsDir = path.join(__dirname);

// Find all TypeScript and JavaScript files in scripts directory
const files = glob.sync(path.join(scriptsDir, '**/*.{ts,js}'), {
  ignore: ['**/node_modules/**', '**/fix-prisma-imports.js']
});

let fixedCount = 0;
let skippedCount = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf-8');
    const originalContent = content;

    // Check if file creates new PrismaClient
    if (content.includes('new PrismaClient()')) {
      console.log(`\n📝 Fixing: ${path.basename(file)}`);

      // Replace the import and instantiation
      content = content.replace(
        /import\s+{\s*PrismaClient\s*}\s+from\s+['"]@prisma\/client['"]\s*;?\s*\n+\s*const\s+prisma\s*=\s*new\s+PrismaClient\(\)\s*;?/g,
        "import { prisma } from '../lib/prisma';"
      );

      // Also handle cases where import and instantiation are separate
      if (content.includes('new PrismaClient()')) {
        content = content.replace(
          /import\s+{\s*PrismaClient\s*}\s+from\s+['"]@prisma\/client['"]/g,
          "import { prisma } from '../lib/prisma'"
        );
        content = content.replace(
          /const\s+prisma\s*=\s*new\s+PrismaClient\(\)\s*;?/g,
          '// Using singleton prisma client from lib/prisma'
        );
      }

      // Only write if content actually changed
      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf-8');
        fixedCount++;
        console.log(`  ✅ Fixed import in ${path.basename(file)}`);
      } else {
        console.log(`  ⚠️  Pattern not matched in ${path.basename(file)}`);
        skippedCount++;
      }
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${file}:`, error.message);
    skippedCount++;
  }
});

console.log(`\n\n📊 Summary:`);
console.log(`  ✅ Fixed: ${fixedCount} files`);
console.log(`  ⚠️  Skipped: ${skippedCount} files`);
console.log(`\n💡 Recommendation: Review skipped files manually and ensure they use the singleton pattern.`);
