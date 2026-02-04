#!/bin/bash
# Script à exécuter sur l'EC2

echo "=== VÉRIFICATION CRON DOCKER ==="
echo ""

echo "1. Conteneurs en cours :"
docker ps | grep cron

echo ""
echo "2. Logs du conteneur nextjs_cron (dernières lignes) :"
docker logs nextjs_cron --tail 30

echo ""
echo "3. Logs du conteneur peds-cron (dernières lignes) :"
docker logs peds-cron --tail 30

echo ""
echo "4. Test manuel de l'API :"
curl -s "https://peds.vercel.app/api/cron/process-queue" | head -c 200

echo ""
echo "=== FIN ==="
