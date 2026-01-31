const { Client } = require('pg');

async function forceKillConnections() {
  // Create a direct connection (not using connection pool)
  const client = new Client({
    host: '16.171.66.98',
    port: 54322,
    user: 'postgres',
    password: 'your-super-secret-and-long-postgres-password',
    database: 'postgres',
    // Force single connection
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('🔌 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected!');

    // Kill all idle connections
    const result = await client.query(`
      SELECT pg_terminate_backend(pid), pid, usename, application_name, state
      FROM pg_stat_activity
      WHERE datname = 'postgres'
        AND pid <> pg_backend_pid()
        AND state = 'idle'
        AND state_change < NOW() - INTERVAL '2 minutes'
    `);

    console.log(`✅ Terminated ${result.rowCount} idle connections`);

    // Show remaining connections
    const remaining = await client.query(`
      SELECT count(*) as count, state
      FROM pg_stat_activity
      WHERE datname = 'postgres'
      GROUP BY state
    `);

    console.log('\n📊 Current connections by state:');
    remaining.rows.forEach(row => {
      console.log(`  ${row.state}: ${row.count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Solutions:');
    console.log('1. SSH into your EC2 instance and restart PostgreSQL:');
    console.log('   sudo systemctl restart postgresql');
    console.log('2. Or manually kill connections:');
    console.log('   sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = \'postgres\' AND pid <> pg_backend_pid();"');
  } finally {
    await client.end();
  }
}

forceKillConnections();
