
// Check ALL critical API keys
const { PrismaClient } = require('@prisma/client');

async function check() {
    const prisma = new PrismaClient();
    try {
        console.log('\n=== FULL SYSTEM CHECK ===\n');

        // Check Global Settings
        const keysToCheck = [
            'openrouter_api_key',
            'venice_api_key',
            'mem0_api_key',
            'anthropic_api_key'
        ];

        const settings = await prisma.setting.findMany({
            where: { key: { in: keysToCheck } }
        });

        const settingsMap = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {});

        console.log('--- GLOBAL SETTINGS ---');
        keysToCheck.forEach(key => {
            const val = settingsMap[key];
            const status = val && val.length > 5 ? '✅ CONFIGURED' : '❌ MISSING';
            console.log(`${key.padEnd(25)}: ${status}`);
        });

        // Check Agents
        const agents = await prisma.agent.findMany({
            include: { settings: true }
        });

        console.log('\n--- AGENT OVERRIDES ---');
        for (const agent of agents) {
            console.log(`\nAgent: ${agent.name} (${agent.id})`);
            keysToCheck.forEach(key => {
                const agentSetting = agent.settings.find(s => s.key === key);
                if (agentSetting) {
                    const status = agentSetting.value && agentSetting.value.length > 5 ? '✅ OVERRIDE' : '❌ EMPTY OVERRIDE';
                    console.log(`  ${key.padEnd(25)}: ${status}`);
                }
            });
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
