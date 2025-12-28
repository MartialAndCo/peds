const axios = require('axios');

// CONFIG
// If running locally alongside Next.js on the same server:
const API_URL = 'http://localhost:3000/api/cron/process-queue';
const INTERVAL_MS = 60 * 1000; // Check every 1 minute

console.log(`[Queue Worker] Starting... Target: ${API_URL}`);

async function tick() {
    try {
        const start = Date.now();
        const res = await axios.get(API_URL);
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] Tick: Success (${duration}ms) - Processed: ${res.data.processed || 0}`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Tick: Error - ${error.message}`);
    }
}

// Run immediately then interval
tick();
setInterval(tick, INTERVAL_MS);
