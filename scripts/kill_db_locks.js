
const { Client } = require('pg');
require('dotenv').config();

async function clean() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        console.log("Connected. Checking for blocking connections...");

        // Find and Kill blocking queries (idle in transaction or active long running)
        // Be aggressive as authorized by user
        const res = await client.query(`
            SELECT pid, state, query, age(clock_timestamp(), query_start) as duration
            FROM pg_stat_activity 
            WHERE pid <> pg_backend_pid() 
            AND datname = current_database()
            And (state = 'idle in transaction' OR state = 'active');
        `);

        console.log(`Found ${res.rowCount} potential blocking connections.`);

        for (const row of res.rows) {
            console.log(`🔫 Terminating PID ${row.pid} [${row.state}] - ${row.query ? row.query.substring(0, 30) : 'NO QUERY'}...`);
            try {
                await client.query(`SELECT pg_terminate_backend(${row.pid})`);
            } catch (e) { console.error(`Failed to kill ${row.pid}: ${e.message}`); }
        }

    } catch (e) {
        console.error('Error cleaning locks:', e);
    } finally {
        await client.end();
    }
}
clean();
