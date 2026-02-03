// Check if OpenRouter API key is configured
const { PrismaClient } = require('@prisma/client');

async function check() {
    const prisma = new PrismaClient();
    try {
        const settings = await prisma.setting.findFirst();
        console.log('\n=== VISION SYSTEM CHECK ===\n');
        console.log('OpenRouter API Key:', settings?.openrouter_api_key ? '✅ CONFIGURED' : '❌ MISSING');
        console.log('Venice API Key:', settings?.venice_api_key ? '✅ CONFIGURED' : '❌ MISSING');
        console.log('\n===========================\n');

        if (!settings?.openrouter_api_key) {
            console.log('❌ PROBLEM: OpenRouter API key is missing!');
            console.log('   Vision cannot work without it.');
            console.log('\n   Fix: Add OPENROUTER_API_KEY in your .env file or settings');
        } else {
            console.log('✅ OpenRouter key is present');
            console.log('   If vision still fails, check the logs for errors');
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();