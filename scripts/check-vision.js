
// Check if OpenRouter API key is configured
const { PrismaClient } = require('@prisma/client');

async function check() {
    const prisma = new PrismaClient();
    try {
        console.log('\n=== VISION SYSTEM CHECK ===\n');

        // Check Global Settings
        const openRouterSetting = await prisma.setting.findUnique({
            where: { key: 'openrouter_api_key' }
        });

        const veniceSetting = await prisma.setting.findUnique({
            where: { key: 'venice_api_key' }
        });

        const hasOpenRouter = !!openRouterSetting?.value;
        const hasVenice = !!veniceSetting?.value;

        console.log('OpenRouter API Key:', hasOpenRouter ? '✅ CONFIGURED' : '❌ MISSING');
        console.log('Venice API Key:', hasVenice ? '✅ CONFIGURED' : '❌ MISSING');
        console.log('\n===========================\n');

        if (!hasOpenRouter) {
            console.log('❌ PROBLEM: OpenRouter API key is missing!');
            console.log('   Vision cannot work without it.');
        } else {
            console.log('✅ OpenRouter key is present');
            // Check Agents
            const agents = await prisma.agent.findMany({
                include: { settings: true }
            });
            console.log(`\nChecking ${agents.length} agents:`);

            for (const agent of agents) {
                const agentKey = agent.settings.find(s => s.key === 'openrouter_api_key');
                const status = agentKey ? '✅ OVERRIDE PRESENT' : '⚪ USING GLOBAL';
                console.log(`- Agent ${agent.name}: ${status}`);
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();