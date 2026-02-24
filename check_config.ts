import { prisma } from './lib/prisma';

async function main() {
    console.log('--- Checking DB Settings ---');
    try {
        const settings = await prisma.setting.findMany();
        console.log('Settings Found:', settings);

        const endpoint = settings.find(s => s.key === 'waha_endpoint');
        const apiKey = settings.find(s => s.key === 'waha_api_key');

        console.log('--- Configuration Resolution ---');
        console.log('DB waha_endpoint:', endpoint?.value);
        console.log('Env WAHA_ENDPOINT:', process.env.WAHA_ENDPOINT);
        console.log('Final Endpoint Logic: ', endpoint?.value || process.env.WAHA_ENDPOINT || 'http://127.0.0.1:3001');
    } catch (e) {
        console.error('Error reading settings:', e);
    }
}

main();
