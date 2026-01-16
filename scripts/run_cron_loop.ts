import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function runCron(name: string, endpoint: string) {
    try {
        // console.log(`[CronLoop] Triggering ${name}...`);
        const res = await axios.get(`${BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'x-vercel-cron': 'true' // Bypass potential checks
            },
            timeout: 10000
        });
        // Only log if something interesting happens or just keep it minimal
        if (res.data?.processed > 0 || res.data?.results?.length > 0) {
            console.log(`[CronLoop] ${name}: Processed items`, res.data);
        }
    } catch (error: any) {
        // Ignore 404 (if likely just endpoint missing) or connection refused (server down)
        if (error.code === 'ECONNREFUSED') {
            console.error(`[CronLoop] Connection Refused. Is server running at ${BASE_URL}?`);
        } else {
            // console.error(`[CronLoop] ${name}: Failed`, error.message);
        }
    }
}

async function loop() {
    console.log(`🚀 Starting Local Cron Loop targeting ${BASE_URL}...`);
    console.log('Press Ctrl+C to stop.');

    while (true) {
        // Run sequentially to avoid load spike
        await runCron('Voice Processor', '/api/cron/process-voice');
        await runCron('Message Queue', '/api/cron/process-queue');
        await runCron('Incoming Processor', '/api/cron/process-incoming');

        // Wait 10s
        await new Promise(r => setTimeout(r, 10000));
    }
}

loop();
