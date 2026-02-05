# 🚨 System Monitoring - Documentation

## Overview

Le système de monitoring permet de suivre en temps réel les erreurs et problèmes de tous les services (WhatsApp, Discord, Next.js) depuis le dashboard admin.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Admin Dashboard │────▶│  API Next.js     │────▶│  Log Aggregator │
│  (/admin/system) │     │  (/api/admin/...)│     │  (lib/monitor/) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
     ┌──────────┐      ┌──────────┐      ┌──────────┐
     │ WhatsApp │      │ Discord  │      │  Next.js │
     │  :3001   │      │  Docker  │      │   DB     │
     └──────────┘      └──────────┘      └──────────┘
```

## Composants

### 1. Base de données
- **Table `SystemLog`** : Stocke les erreurs avec TTL (7 jours)
- **Table `Notification`** : Notifications pour erreurs CRITICAL

### 2. API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/monitor/logs` | Récupère les logs agrégés |
| `GET /api/admin/monitor/stream` | Server-Sent Events (temps réel) |
| `POST /api/admin/monitor/collect` | Collecte et notifie (cron) |
| `GET /api/cron/cleanup-logs` | Nettoie les vieux logs |
| `GET /api/docker-logs` (Baileys) | Récupère logs Docker Discord/Cron |

### 3. Frontend
- Dashboard `/admin/system` refondu avec :
  - Stats cards (CRITICAL, ERROR, WARN)
  - Filtres par source et niveau
  - Table temps réel avec SSE
  - Notifications auto pour CRITICAL

## Configuration

### Variables d'environnement

```bash
# Déjà configurées normalement
WAHA_ENDPOINT=http://13.60.16.81:3001
AUTH_TOKEN=xxx
WEBHOOK_SECRET=xxx
```

### Cron Jobs

Ajouter dans `docker-compose.yml` ou vos cron Amplify :

```bash
# Collecte des logs toutes les 5 minutes
*/5 * * * * curl -H "x-internal-secret: $WEBHOOK_SECRET" https://votre-app.com/api/admin/monitor/collect

# Nettoyage des vieux logs toutes les heures
0 * * * * curl -H "x-internal-secret: $WEBHOOK_SECRET" https://votre-app.com/api/cron/cleanup-logs
```

## Utilisation

### Dashboard
1. Aller sur `/admin/system`
2. Les erreurs s'affichent en temps réel
3. Cliquer sur "Show More" pour voir le contexte complet
4. Utiliser les filtres pour affiner la vue

### Notifications
- Les erreurs CRITICAL créent automatiquement des notifications
- Elles apparaissent dans `/admin/notifications`
- Type : `SYSTEM_ERROR`

### Développement

Pour tester la collecte :
```bash
curl -X POST https://votre-app.com/api/admin/monitor/collect \
  -H "x-internal-secret: votre-secret"
```

Pour voir les stats :
```bash
curl https://votre-app.com/api/admin/monitor/collect \
  -H "x-internal-secret: votre-secret"
```

## Patterns de détection

Les erreurs sont classifiées automatiquement selon :

| Pattern | Niveau | Catégorie |
|---------|--------|-----------|
| `FATAL`, `unhandledException` | CRITICAL | system |
| `heap out of memory` | CRITICAL | memory |
| `ECONNREFUSED` | CRITICAL | connection |
| `500`, `502`, `503` | ERROR | api |
| `timeout`, `ETIMEDOUT` | ERROR | api |
| `prisma`, `database` | CRITICAL | database |
| `slow query` | WARN | database |

## Dépannage

### Pas de logs Discord
Vérifier que le endpoint `/api/docker-logs` est accessible sur Baileys et que le conteneur a accès au socket Docker.

### Notifications non reçues
Vérifier que les cron jobs sont configurés et que `WEBHOOK_SECRET` est correct.

### Erreurs de permission Prisma
Le `prisma generate` peut échouer si le serveur dev tourne. Redémarrer le serveur ou utiliser `npx prisma db push --accept-data-loss`.
