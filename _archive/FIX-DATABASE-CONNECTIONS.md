# Database Connection Pool Exhaustion - Fix Guide

## Problem
PostgreSQL has run out of available connection slots. All connections are being used and new connections are rejected.

## Immediate Fix (Required Now)

### Option 1: Restart PostgreSQL (Fastest)
SSH into your EC2 instance and restart PostgreSQL:

```bash
ssh -i your-key.pem ubuntu@16.171.66.98
sudo systemctl restart postgresql
# or if using Docker/Supabase:
sudo docker restart supabase_db_postgres
```

### Option 2: Kill Idle Connections
If you can't restart, kill idle connections:

```bash
ssh -i your-key.pem ubuntu@16.171.66.98
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid() AND state = 'idle';"
```

## Long-term Fixes (Already Applied)

### 1. Updated Prisma Client (`lib/prisma.ts`)
- Added graceful shutdown handling
- Proper singleton pattern to prevent multiple instances

### 2. Updated DATABASE_URL (`.env`)
- Added `connection_limit=5` - limits connections per process
- Added `pool_timeout=10` - timeout for acquiring connections

### 3. Connection Pool Parameters Explained
```
connection_limit=5    # Max connections per Prisma instance
pool_timeout=10       # Seconds to wait for available connection
```

## Increase PostgreSQL Max Connections (Recommended)

Your PostgreSQL might be configured with too few max connections. To increase:

```bash
ssh -i your-key.pem ubuntu@16.171.66.98
sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = 100;"
sudo systemctl restart postgresql
```

Check current settings:
```bash
sudo -u postgres psql -c "SHOW max_connections;"
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

## Best Practices Going Forward

### 1. Always Import Prisma from Singleton
❌ BAD:
```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient() // Creates new instance!
```

✅ GOOD:
```typescript
import { prisma } from '../lib/prisma' // Use singleton
```

### 2. Close Connections in Scripts
All scripts should disconnect:
```typescript
try {
  // ... your code
} finally {
  await prisma.$disconnect()
}
```

### 3. Monitor Connection Usage
Run this query periodically:
```sql
SELECT count(*), state
FROM pg_stat_activity
WHERE datname = 'postgres'
GROUP BY state;
```

### 4. Check for Connection Leaks
Look for scripts creating their own PrismaClient instances:
```bash
grep -r "new PrismaClient()" scripts/
```

All these scripts should use the singleton from `lib/prisma.ts`.

## After Restarting

1. Restart your Next.js dev server:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. Monitor connections:
   ```bash
   node scripts/force-kill-connections.js
   ```

3. Check your dashboard - it should load now

## Prevention

- Always use the singleton Prisma client
- Close connections in scripts with `finally` blocks
- Consider using a connection pooler like PgBouncer for production
- Monitor connection counts regularly
