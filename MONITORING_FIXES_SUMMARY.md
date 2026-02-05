# Corrections du Système de Monitoring

## Problèmes identifiés et corrigés

### 1. Endpoint `/api/logs` nécessitait une clé API
**Fichier:** `services/baileys/src/index.ts`

Le endpoint `/api/logs` n'était pas exempté d'authentification dans le `preHandler` hook. Seul `/api/logs/ingest` l'était.

**Correction:**
```typescript
// Avant:
const exemptPaths = ['/status', '/api/status', '/health', '/api/logs/ingest']

// Après:
const exemptPaths = ['/status', '/api/status', '/health', '/api/logs', '/api/logs/ingest']
```

### 2. Log Buffer vide (aucun log métier)
**Fichier:** `services/baileys/src/index.ts`

Le `logBuffer` n'était alimenté que par les requêtes HTTP (dans le hook `onResponse`). Les événements WhatsApp importants (connexion, messages, erreurs) n'étaient pas loggués.

**Correction:** Ajout de `addToLogBuffer()` dans les événements:
- `connection.update` - QR généré, connexion ouverte/fermée, reconnexion
- `messages.upsert` - Messages entrants

Exemple:
```typescript
addToLogBuffer(`${new Date().toISOString()} [${sessionId}] Connection established`)
addToLogBuffer(`${new Date().toISOString()} [${sessionId}] Message from ${sender}`)
```

### 3. Pas d'endpoint `/health`
**Fichier:** `services/baileys/src/index.ts`

Il n'y avait pas d'endpoint pour vérifier l'état du serveur.

**Correction:** Ajout du endpoint `/health`:
```typescript
server.get('/health', async (req: any, reply) => {
    return { 
        success: true, 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        sessions: sessions.size
    }
})
```

### 4. Fixes précédents (déjà poussés)
- Correction des URLs base64 sans préfixe `data:image/jpeg;base64,`
- Forçage du port 3001 pour WhatsApp/Baileys

## Comment tester

### 1. Tester localement
```bash
# Test du endpoint /api/logs
curl http://13.60.16.81:3001/api/logs?lines=10

# Test du health check
curl http://13.60.16.81:3001/health

# Test avec clé API (optionnel maintenant)
curl -H "X-Api-Key: e3f9a1c4d8b2f0a7c5e6d9b1a4f8c2d0e7b5a9c3f1d4b8e6a2f0c7" \
  http://13.60.16.81:3001/api/logs?lines=10
```

### 2. Tester l'API Next.js
```bash
# Lancer le serveur Next.js
cd /path/to/peds
npm run dev

# Test du endpoint (necessite login, mais on peut voir si l'endpoint répond)
curl http://localhost:3000/api/admin/monitor/logs?sources=whatsapp&limit=5
```

### 3. Script de test complet
```bash
npx tsx scripts/test-monitoring-system.ts
```

## Déploiement

Pour déployer les corrections sur le serveur Baileys:

```bash
# Méthode 1: Script automatisé (si vous avez accès SSH)
bash scripts/deploy-baileys-fixes.sh

# Méthode 2: Manuel
# 1. Copier les fichiers modifiés sur le serveur
# 2. Rebuild: npm run build
# 3. Redémarrer: pm2 restart baileys
```

## Flux des logs

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Baileys       │     │   Next.js API    │     │   Dashboard     │
│   Server:3001   │────▶│   /api/admin/    │────▶│   /admin/system │
│                 │     │   monitor/logs   │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │
        │ HTTP GET /api/logs (sans auth)
        │
   ┌────▼────┐
   │logBuffer│ ◀── Alimenté par événements
   │ (500)   │     connection.update
   └─────────┘     messages.upsert
                   HTTP requests
```

## Événements loggués

| Événement | Niveau | Description |
|-----------|--------|-------------|
| QR Generated | INFO | QR code généré, attente scan |
| Connection established | INFO | Session connectée |
| Connection closed | WARN | Connexion fermée (code status) |
| Auto-reconnecting | INFO | Reconnexion automatique |
| QR timeout | WARN | Timeout QR, restart manuel nécessaire |
| ERROR: Session logged out | ERROR | Déconnexion définitive |
| ERROR: Startup 401 | ERROR | Échec authentification |
| Message from X | INFO | Message reçu |

## Prochaines améliorations suggérées

1. **Persistance des logs** - Sauvegarder les logs critiques en DB
2. **Alertes** - Envoyer des notifications pour les erreurs CRITICAL
3. **Filtrage** - Permettre de filtrer par session ID
4. **Logs temps réel** - WebSocket pour les logs en direct
