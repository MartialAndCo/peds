import { PrismaClient } from '@prisma/client';

async function killIdleConnections() {
  const prisma = new PrismaClient();

  try {
    // Kill idle connections older than 5 minutes
    const result = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'idle'
        AND state_change < NOW() - INTERVAL '5 minutes';
    `);

    console.log(`✅ Terminated ${result} idle connections`);

    // Show current connection count
    const connections = await prisma.$queryRawUnsafe(`
      SELECT count(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database();
    `) as Array<{ count: bigint }>;

    console.log(`📊 Current active connections: ${connections[0].count}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

killIdleConnections();
