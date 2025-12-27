
const { Client } = require('pg');
require('dotenv').config();

async function patch() {
    console.log('Patching Database: Adding lastTrustAnalysis to Contact...');

    // Use DIRECT_URL if available, else DATABASE_URL
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('No connection string found!');
        process.exit(1);
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000 // 10s timeout
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected! Verifying access...');
        await client.query('SELECT NOW()');

        // 1. Add lastTrustAnalysis column
        await client.query(`
            ALTER TABLE "contacts" 
            ADD COLUMN IF NOT EXISTS "lastTrustAnalysis" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('✅ Added "lastTrustAnalysis" column.');

    } catch (e) {
        console.error('❌ Patch Failed:', e);
    } finally {
        await client.end();
    }
}

patch();
