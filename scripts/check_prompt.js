const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking Active Prompt...");
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } });
    if (prompt) {
        console.log(`CURRENT PROMPT (${prompt.name}):\n${prompt.system_prompt.substring(0, 200)}...`);
    } else {
        console.log("❌ No active prompt found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
