import os
with open('/root/peds/.env', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if line.startswith('DATABASE_URL='):
        lines[i] = 'DATABASE_URL="postgresql://postgres:PedsAppSupabaseDb2026!@127.0.0.1:54322/postgres?connection_limit=20&pool_timeout=20"\n'
with open('/root/peds/.env', 'w') as f:
    f.writelines(lines)
