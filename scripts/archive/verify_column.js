
const { Client } = require('pg');
require('dotenv').config();

async function verify() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='contacts' AND column_name='lastTrustAnalysis';
        `);

        if (res.rows.length > 0) {
            console.log('✅ Column lastTrustAnalysis EXISTS.');
        } else {
            console.log('❌ Column lastTrustAnalysis MISSING.');
        }

    } catch (e) {
        console.error('Verification Error:', e);
    } finally {
        await client.end();
    }
}

verify();
