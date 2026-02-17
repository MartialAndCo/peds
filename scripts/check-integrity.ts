
import { prisma } from '../lib/prisma';
import { logSystemError } from '../lib/monitoring/system-logger';
import { settingsService } from '../lib/settings-cache';

async function checkIntegrity() {
    console.log('🔍 Starting System Integrity Check...');
    const errors: string[] = [];

    try {
        // 1. Check OpenRouter Key
        console.log('👉 Checking OpenRouter Key...');
        let openRouterKey;
        try {
            openRouterKey = await settingsService.getSettings().then(s => s.openrouter_api_key);
        } catch (e) {
            console.error('❌ Failed to get settings:', e);
            errors.push('❌ Critical: Settings Service Failure');
        }

        if (!openRouterKey) {
            errors.push('❌ Missing OPENROUTER_API_KEY in Settings');
        } else {
            console.log('✅ OpenRouter API Key configured');
        }

        // 2. Check Venice Key
        console.log('👉 Checking Venice Key...');
        const veniceKeyEnv = process.env.VENICE_API_KEY;
        const veniceKeySetting = await settingsService.getSettings().then(s => s.venice_api_key);

        if (!veniceKeyEnv && !veniceKeySetting) {
            errors.push('❌ Missing VENICE_API_KEY (Env or Settings)');
        } else {
            console.log('✅ Venice API Key configured');
        }

        // 3. Check Mem0 Key
        console.log('👉 Checking Mem0 Key...');
        const mem0Key = await settingsService.getSettings().then(s => s.mem0_api_key);
        if (!mem0Key) {
            errors.push('❌ Missing MEM0_API_KEY in Settings');
        } else {
            console.log('✅ Mem0 API Key configured');
        }



        // Report results
        if (errors.length > 0) {
            console.error('🚨 INTEGRITY CHECK FAILED');
            errors.forEach(e => console.error(e));

            const errorMessage = `Startup Integrity Failed:\n${errors.join('\n')}`;

            console.log('👉 Sending Critical Alert...');
            await logSystemError(
                'cron',
                'CRITICAL',
                errorMessage,
                JSON.stringify({ errors }),
                'startup-check'
            );

            console.log('📨 Critical Alert sent');
            process.exit(1);
        } else {
            console.log('✅ SYSTEM INTEGRITY PASSED');
            process.exit(0);
        }

    } catch (error) {
        console.error('🔥 Fatal error in checkIntegrity:', error);
        process.exit(1);
    }
}

checkIntegrity();
