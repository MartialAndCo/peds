# 🔥 Migration DIRECTOR → SWARM-ONLY

**Date:** 2026-02-07  
**Statut:** ✅ TERMINÉE

---

## 📋 Résumé

Le système a été migré pour utiliser **UNIQUEMENT le SWARM**, le director legacy étant archivé.

### Pourquoi ?
- Le director avec son prompt unifié posait problème (répétitions, manque d'écoute)
- Le swarm permet une approche modulaire plus contrôlable
- Les nouvelles règles strictes anti-répétition et d'écoute active sont appliquées

---

## ✅ Changements effectués

### 1. Archivage
- `lib/director.ts` (original) → `_archive/legacy-director/2026-02-07/`
- `lib/config/ai-mode.ts` (original) → `_archive/legacy-director/2026-02-07/`

### 2. Nouveau `lib/config/ai-mode.ts`
```typescript
// SWARM-ONLY - Director legacy archived
export const aiConfig = {
    mode: 'SWARM',           // 🔒 Forcé
    isSwarm: () => true,     // 🔒 Toujours true
    isClassic: () => false   // 🔒 Toujours false
}
```

### 3. Nouveau `lib/director.ts` (stub)
- `buildSystemPrompt()` → Retourne `null` (force le SWARM)
- `determinePhase()` → Conservé (utilisé par le swarm)
- `performSignalAnalysis()` → Conservé (utilisé par le swarm)

### 4. Modifications `lib/handlers/chat.ts`
- `callAI()` → SWARM uniquement, fallback classic supprimé
- `generateAndSendAI()` → Simplifié (plus de systemPrompt manuel)
- Suppression des injections de life context (géré par timingNode)

### 5. Améliorations `lib/swarm/nodes/phase-node.ts`
**Nouvelles règles pour VULNERABILITY:**
- ✅ VARIÉTÉ OBLIGATOIRE: Liste de 7 thèmes possibles (famille, école, amis, argent, santé, amour, logement)
- ✅ ANTI-RÉPÉTITION: Interdiction absolue de reparler d'un sujet des 10 derniers messages
- ✅ SUBTILITÉ: Expressions indirectes obligatoires (pas "maman stresse pour les factures")
- ✅ ÉCOUTE ACTIVE: Réagir au message de l'utilisateur AVANT de parler de soi
- ✅ VARIÉTÉ DES EXPRESSIONS: Varier les tics de langage

### 6. Améliorations `lib/swarm/nodes/response-node.ts`
- ✅ **ÉCOUTE ACTIVE**: Bloc de règles critique ajouté en début de prompt
- ✅ **ANTI-RÉPÉTITION DYNAMIQUE**: Récupération des 5 derniers messages AI pour les interdire
- ✅ Exemples corrects/interdits pour l'écoute active

---

## 🧪 Tests recommandés

### Test 1: Anti-répétition
```
User: "Ça va ?"
AI: "chui coincée chez moi maman stresse"
User: "Et sinon ?"
AI: [NE DOIT PAS répéter "maman stresse" ou "factures"]
```

### Test 2: Écoute active
```
User: "Je vais voir ma nièce faire de la gym"
AI: [DOIT d'abord réagir à la gym/nièce, PAS ignorer pour parler de ses problèmes]
```

### Test 3: Variété des sujets
Vérifier sur 5-6 échanges que l'AI ne revient pas toujours sur le même problème.

---

## 🚀 Déploiement

```bash
# 1. Vérifier la compilation
npm run build

# 2. Redémarrer le serveur
npm run dev
# ou
npm start
```

---

## 📝 Notes

- Le swarm est maintenant le seul mode actif
- Le director legacy est archivé mais peut être restauré si besoin
- Les règles anti-répétition sont maintenant intégrées dans le phase-node
- L'écoute active est forcée dans le response-node

---

## 🔧 Rollback (si nécessaire)

```bash
# Restaurer depuis l'archive
cp _archive/legacy-director/2026-02-07/director.ts lib/director.ts
cp _archive/legacy-director/2026-02-07/ai-mode.ts lib/config/ai-mode.ts

# Restaurer chat.ts depuis git
git checkout lib/handlers/chat.ts
```
