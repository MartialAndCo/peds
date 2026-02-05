# 🚀 Déploiement - System Monitoring

## Résumé des changements

Ce déploiement ajoute un **système de monitoring temps réel** qui remplace l'ancienne page de logs basique.

## Ce qui est déployé

### 1. Base de données
- Nouvelle table `SystemLog` avec TTL (7 jours)
- Mise à jour de la table `Notification` (type `SYSTEM_ERROR`)

### 2. Backend
- `lib/monitoring/` - Logique d'agrégation et détection d'erreurs
- `app/api/admin/monitor/` - API endpoints (logs, stream, collect)
- `app/api/cron/cleanup-logs` - Nettoyage automatique

### 3. Frontend
- `app/admin/system/page.tsx` - Dashboard temps réel refondu
- Stats cards, filtres, tableau d'erreurs
- Server-Sent Events pour mises à jour live

### 4. WhatsApp Server (Baileys)
- Nouvel endpoint `/api/docker-logs` pour récupérer les logs Discord/Cron

## Étapes de déploiement

### 1. Déployer le code
```bash
git pull
npm ci --legacy-peer-deps
npx prisma db push --accept-data-loss
npm run build
```

### 2. Redémarrer le serveur WhatsApp (pour l'endpoint Docker logs)
```bash
docker-compose up -d --build whatsapp-server
```

### 3. Vérifier le fonctionnement
- Aller sur `/admin/system`
- Vérifier que les erreurs s'affichent
- Tester les filtres par source/niveau

## API Endpoints disponibles

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/admin/monitor/logs` | GET | Récupère les logs agrégés |
| `/api/admin/monitor/logs` | POST | Marque logs comme lus |
| `/api/admin/monitor/stream` | GET | SSE temps réel |
| `/api/admin/monitor/collect` | POST | Collecte + notifications |
| `/api/cron/cleanup-logs` | GET | Nettoie vieux logs |
| `/api/docker-logs` (Baileys) | GET | Logs Docker Discord/Cron |

## Configuration optionnelle (Cron jobs)

Pour activer la collecte auto et notifications :

```bash
# Collecte toutes les 5 minutes
*/5 * * * * curl -H "x-internal-secret: $WEBHOOK_SECRET" https://votre-app.com/api/admin/monitor/collect

# Nettoyage toutes les heures
0 * * * * curl -H "x-internal-secret: $WEBHOOK_SECRET" https://votre-app.com/api/cron/cleanup-logs
```

## Dépannage

### Pas de logs Discord
Vérifier que Baileys a accès au socket Docker :
```bash
docker exec baos docker logs discord_bot --tail 10
```

### Erreurs Prisma
Redémarrer le serveur Next.js après `db push`.

### Notifications non reçues
Vérifier que `WEBHOOK_SECRET` est configuré et que les cron jobs tournent.
