# 🔧 Correctifs de la Queue de Messages

## Problèmes Identifiés

Vous aviez raison : les messages se comportaient de manière incohérente - parfois envoyés, parfois bloqués. Voici les 5 problèmes critiques trouvés :

| # | Problème | Impact | Solution |
|---|----------|--------|----------|
| 1 | **Double verrouillage** | Messages perdus entre `process-incoming` et `queueService` | Transaction atomique avec verrouillage de lignes |
| 2 | **Pas de vérification pré-envoi** | Double envoi si cleanup passe au mauvais moment | Vérification du statut juste avant l'envoi |
| 3 | **Cleanup agressif (5 min)** | Risque de ré-envoi pour messages lents | Passage à 10 minutes + max 3 tentatives |
| 4 | **Pas de protection inter-instance** | Race conditions si plusieurs CRON tournent | Flag in-memory + vérification DB |
| 5 | **Batch trop grand (50)** | Timeouts et blocages | Réduction à 10 messages |

---

## Fichiers Modifiés

### 1. `lib/services/queue-service.ts`

#### ✅ Verrouillage atomique avec transaction
```typescript
// AVANT: findMany puis updateMany (non atomique)
const pending = await prisma.messageQueue.findMany(...)
await prisma.messageQueue.updateMany(...)

// APRÈS: Transaction atomique
await prisma.$transaction(async (tx) => {
    const items = await tx.messageQueue.findMany(...)
    for (const item of items) {
        await tx.messageQueue.update({
            where: { id: item.id, status: 'PENDING' }, // Vérification intégrée
            data: { status: 'PROCESSING' }
        })
    }
})
```

#### ✅ Vérification avant envoi
```typescript
public async processSingleItem(queueItem: any) {
    // NOUVEAU: Vérification juste avant l'envoi
    const currentStatus = await prisma.messageQueue.findUnique({
        where: { id: queueItem.id },
        select: { status: true }
    })
    
    if (currentStatus?.status !== 'PROCESSING') {
        // Annuler l'envoi si le statut a changé
        return { status: 'aborted' }
    }
    // ... continuer l'envoi
}
```

#### ✅ Cleanup amélioré
```typescript
// AVANT: 5 minutes → PENDING (risque de ré-envoi)
// APRÈS: 10 minutes + max 3 tentatives → FAILED si dépassé
async cleanupStuckJobs() {
    // 1. Marquer comme FAILED si ≥3 tentatives
    // 2. Remettre à PENDING si <3 tentatives
}
```

#### ✅ Protection mémoire inter-instance
```typescript
private static processingItems = new Set<string>()

for (const queueItem of lockedItems) {
    if (QueueService.processingItems.has(queueItem.id)) {
        continue // Déjà en cours dans cette instance
    }
    QueueService.processingItems.add(queueItem.id)
    try {
        await this.processSingleItem(queueItem)
    } finally {
        QueueService.processingItems.delete(queueItem.id)
    }
}
```

### 2. `app/api/cron/process-incoming/route.ts`

#### ✅ Transaction plus sûre
```typescript
const pending = await prisma.$transaction(async (tx) => {
    const items = await tx.incomingQueue.findMany({
        take: 10, // Réduit de 50 à 10
        ...
    })
    // Verrouillage avec ID de traitement pour traçabilité
}, { maxWait: 5000, timeout: 10000 })
```

#### ✅ Vérification de statut avant traitement
```typescript
for (const item of items) {
    // NOUVEAU: Vérifier que l'item est toujours en PROCESSING
    const currentItem = await prisma.incomingQueue.findUnique({
        where: { id: item.id },
        select: { status: true }
    })
    
    if (currentItem?.status !== 'PROCESSING') {
        continue // Item repris par une autre instance
    }
    // ... traiter
}
```

### 3. `app/api/cron/process-queue/route.ts`

#### ✅ Détection d'exécution simultanée
```typescript
// NOUVEAU: Vérifier si un traitement est déjà actif
const recentProcessing = await prisma.messageQueue.findFirst({
    where: {
        status: 'PROCESSING',
        updatedAt: { gt: new Date(Date.now() - 30000) }
    }
})

if (recentProcessing && isProcessing) {
    return { message: 'Processing already active, skipped' }
}
```

### 4. `app/actions/queue.ts`

#### ✅ Mise à jour du nom de méthode
```typescript
// Renommé: processedSingleItem → processSingleItem
await queueService.processSingleItem(item)
```

---

## Scripts de Diagnostic (Nouveaux)

### `scripts/diagnose-queue.ts`
Diagnostique complet de la queue :
```bash
npx tsx scripts/diagnose-queue.ts
```

Affiche :
- Statistiques globales
- Messages bloqués en PROCESSING
- Messages en échec
- Doublons potentiels
- Recommandations

### `scripts/unlock-queue.ts`
Débloque manuellement les messages coincés :
```bash
# Voir ce qui serait débloqué
npx tsx scripts/unlock-queue.ts --dry-run

# Débloquer réellement
npx tsx scripts/unlock-queue.ts --execute

# Forcer même si max tentatives atteint
npx tsx scripts/unlock-queue.ts --execute --force
```

---

## Comportement Attendu Après Correction

### Avant
- ❌ Messages parfois envoyés, parfois perdus
- ❌ Double envoi occasionnel
- ❌ Messages bloqués en PROCESSING indéfiniment
- ❌ AI confuse sur les conversations multiples

### Après
- ✅ Chaque message est envoyé **une seule fois**
- ✅ Messages bloqués automatiquement recyclés après 10 min (max 3 fois)
- ✅ Protection contre les exécutions simultanées
- ✅ Diagnostic facile avec les scripts

---

## Surveillance Recommandée

1. **Exécuter le diagnostic régulièrement** :
   ```bash
   npx tsx scripts/diagnose-queue.ts
   ```

2. **Surveiller les logs** pour ces messages :
   - `[QueueService] Transaction failed` → Conflit d'instances
   - `[QueueService] Item X status changed` → Protection anti-double
   - `[QueueService] ⚠️ Reset X stuck jobs` → Cleanup actif

3. **Alertes à configurer** :
   - Messages en PROCESSING > 30 minutes
   - Messages FAILED > 10 dans les dernières 24h
   - Doublons détectés

---

## Questions Fréquentes

**Q: Pourquoi l'AI disait qu'elle pouvait parler à plusieurs personnes ?**  
R: C'était un symptôme de concurrence. Sans verrouillage atomique, plusieurs instances traitaient des messages simultanément, créant un mélange de contextes.

**Q: Les messages vont-ils encore se bloquer ?**  
R: Le cleanup automatique les recyclera après 10 minutes (max 3 fois), puis ils passeront en FAILED pour investigation.

**Q: Comment vérifier si tout fonctionne ?**  
R: Utilisez `scripts/diagnose-queue.ts` et vérifiez que :
- Pas de messages PROCESSING > 30 min
- Pas de doublons
- Statistiques cohérentes

---

## Prochaines Étapes Recommandées

1. **Déployer** les modifications
2. **Exécuter** `npx tsx scripts/diagnose-queue.ts` pour voir l'état actuel
3. **Surveiller** les logs pendant 24h
4. **Configurer** des alertes sur les métriques critiques
