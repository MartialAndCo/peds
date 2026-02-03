# Fix PostgreSQL Connections in Docker Supabase

Run these commands on your EC2 instance:

## Step 1: Find the PostgreSQL Container

```bash
sudo docker ps | grep postgres
```

You should see something like `supabase_db_postgres` or `supabase-db`.

## Step 2: Access PostgreSQL Container

```bash
# Replace 'supabase_db_postgres' with your actual container name
sudo docker exec -it supabase_db_postgres psql -U postgres -d postgres
```

## Step 3: Kill Idle Connections (Inside psql)

```sql
-- Kill all idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'postgres'
  AND pid <> pg_backend_pid()
  AND state = 'idle';

-- Check remaining connections
SELECT count(*), state
FROM pg_stat_activity
WHERE datname = 'postgres'
GROUP BY state;

-- Exit psql
\q
```

## Step 4: Increase Max Connections (Optional but Recommended)

```bash
# Inside the container
sudo docker exec -it supabase_db_postgres psql -U postgres -d postgres -c "ALTER SYSTEM SET max_connections = 100;"

# Restart the container to apply changes
sudo docker restart supabase_db_postgres
```

## One-Liner Solutions

Kill connections:
```bash
sudo docker exec -it supabase_db_postgres psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid() AND state = 'idle';"
```

Increase max connections:
```bash
sudo docker exec -it supabase_db_postgres psql -U postgres -d postgres -c "ALTER SYSTEM SET max_connections = 100;" && sudo docker restart supabase_db_postgres
```

## Step 5: Verify

Check current connections:
```bash
sudo docker exec -it supabase_db_postgres psql -U postgres -d postgres -c "SELECT count(*) as total, state FROM pg_stat_activity WHERE datname = 'postgres' GROUP BY state;"
```

Check max_connections setting:
```bash
sudo docker exec -it supabase_db_postgres psql -U postgres -d postgres -c "SHOW max_connections;"
```
