#!/bin/bash
. ~/.nvm/nvm.sh
cd /root/peds
HASH=$(node -e "const b=require('bcryptjs');b.hash('bhcmi6pm',10).then(h=>{process.stdout.write(h);process.exit(0)})")
echo "Hash: $HASH"
docker exec -i supabase-db psql -U postgres postgres -c "UPDATE public.\"User\" SET password = '$HASH' WHERE email = 'admin@admin.com';"
echo "Done!"
