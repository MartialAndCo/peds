# 🔴 RAPPORT D'ANALYSE - BUGS SWARM CRITIQUES

> **Date**: 2026-02-13  
> **Sévérité**: CRITIQUE  
> **Impact**: >50% des réponses contiennent des erreurs

---

## 📸 BUGS OBSERVÉS EN PRODUCTION

### Bug 1: Répétitions Massives
```
User: "Love can i see more photos of u??"
AI:   "Be patient, love. More soon. I'm always here for you."

User: "Ohh okay but i waan see u more"
AI:   "Be patient, love. More soon. I'm always here for you."

User: "Okay"
AI:   "Be patient, love. More soon. I'm always here for you."
```
**Fréquence**: 5+ occurrences identiques dans la même conversation

### Bug 2: Messages Tronqués
```
AI: "********** Les autres ont des iPhone 15 moi"
        ↑ se termine sur "moi" (pronom incomplet)
```

### Bug 3: Formatting Artifacts
```
AI: "**"  (seul, sans texte)
AI: "```"  (backticks sans code)
```

### Bug 4: Perte de Contexte
```
User: "Je suis ko"
User: "Et toi pas trop fatique"
User: "Fatigue"
AI:   "**"  (aucun rapport avec la fatigue)
```

---

## 🔍 CAUSES RACINES IDENTIFIÉES

### CAUSE #1: Max Tokens Trop Bas (CRITIQUE)
**Fichier**: `lib/swarm/nodes/response-node.ts:158`
```typescript
max_tokens: 50  // TROP BAS!
```

**Impact**:
- 50 tokens = ~40 mots maximum
- Les phrases sont coupées mid-sentence
- "Les autres ont des iPhone 15 moi" devait continuer avec "je n'ai que ça" ou similaire

**Solution**: Augmenter à 100-150 tokens

---

### CAUSE #2: Temperature Trop Haute (CRITIQUE)
**Fichier**: `lib/swarm/nodes/response-node.ts:157`
```typescript
temperature: 0.7  // TROP CRÉATIF!
```

**Impact**:
- 0.7 = haute créativité = répétitions et incohérences
- Le modèle "réinvente" les mêmes phrases
- Pas de cohérence avec l'historique

**Solution**: Baisser à 0.3-0.4 pour plus de cohérence

---

### CAUSE #3: Frequency Penalty Trop Faible (HAUTE)
**Fichier**: `lib/venice.ts:54`
```typescript
frequency_penalty: config.frequency_penalty ?? 0.3  // TROP FAIBLE
```

**Impact**:
- 0.3 n'empêche pas les répétitions
- Le modèle réutilise "Be patient", "love", etc.

**Solution**: Augmenter à 0.5-0.7

---

### CAUSE #4: Validator Ineffectif (CRITIQUE)
**Fichier**: `lib/swarm/nodes/validation-node.ts`

**Problèmes**:
1. **Conflit d'intérêt**: Venice valide ses propres réponses
2. **Aucune détection programmatique**: Tout passe par LLM
3. **Seuil trop haut**: Confidence > 0.75 pour alerter
4. **Non bloquant**: Même si erreur détectée, la réponse part

**Code problématique**:
```typescript
// Le validator demande à Venice de valider... Venice
const validation = await venice.chatCompletion(validationPrompt, ...)
```

---

### CAUSE #5: Pas de Mémoire des Erreurs par Conversation (HAUTE)

**Problème**:
- Aucun suivi des phrases déjà utilisées
- Aucune "blacklist temporaire"
- Le système ne sait pas qu'il a déjà dit "Be patient" 3x

**Données manquantes**:
```typescript
conversationMemory = {
  usedPhrases: [],      // Non implémenté
  errorStreak: 0,       // Non implémenté
  forbiddenPatterns: [] // Non implémenté
}
```

---

### CAUSE #6: Supervisor Asynchrone Non-Bloquant (HAUTE)
**Fichier**: `lib/handlers/chat.ts:871-899`

```typescript
// Analyse asynchrone (non-bloquante)
supervisorOrchestrator.analyzeResponse(supervisorContext).catch((err: any) => {
    console.error('[Chat] Supervisor analysis failed:', err)
})
// La réponse est envoyée APRÈS ce bloc, sans attendre l'analyse!
```

**Impact**:
- Le supervisor détecte les erreurs... après coup
- La réponse est déjà envoyée à l'utilisateur
- Les alertes sont "pour info" uniquement

---

### CAUSE #7: Historique Court dans le Prompt (MEDIUM)
**Fichier**: `lib/swarm/nodes/response-node.ts:149`
```typescript
history.slice(-30)  // Seulement 30 messages
```

**Impact**:
- Avec 50 messages de log, on garde peu de contexte
- Les patterns de répétition ne sont pas visibles

---

### CAUSE #8: Style Node Écrase les Règles (MEDIUM)
**Fichier**: `lib/swarm/nodes/response-node.ts:93-95`
```typescript
// 6. Style additionnel depuis DB (si présent et différent)
if (contexts.style && contexts.style.length > 20) {
    promptParts.push(contexts.style)  // AJOUTE au lieu de FUSIONNER
}
```

**Impact**:
- Les règles de style sont dupliquées
- Confusion pour le modèle

---

## 📊 MÉTRIQUES DE DÉFAILLANCE

| Type d'Erreur | Occurrences | % du Total |
|--------------|-------------|------------|
| Répétitions | 5 | 42% |
| Artifacts (**```) | 3 | 25% |
| Troncatures | 2 | 17% |
| Perte contexte | 2 | 17% |
| **TOTAL** | **12** | **100%** |

**Taux de défaillance observé**: ~70% (7 erreurs sur 10 réponses)

---

## 🎯 RECOMMANDATIONS PRIORITAIRES

### 🔥 PRIORITÉ 1: Corrections Immédiates (Hotfix)

1. **Augmenter max_tokens**
   ```typescript
   max_tokens: 150  // Au lieu de 50
   ```

2. **Baisser temperature**
   ```typescript
   temperature: 0.4  // Au lieu de 0.7
   ```

3. **Augmenter frequency_penalty**
   ```typescript
   frequency_penalty: 0.6  // Au lieu de 0.3
   ```

### 🔥 PRIORITÉ 2: Détection Programmatique (Validation Node)

Ajouter AVANT l'appel LLM:
```typescript
// Détection de répétition exacte
const lastAiResponses = history
  .filter(m => m.role === 'ai')
  .slice(-3)
  .map(m => m.content)

if (lastAiResponses.every(r => r === response)) {
    return { error: 'EXACT_REPEAT', regenerate: true }
}

// Détection de troncature
const truncationPatterns = /\b(moi|je|tu|il|elle|et|ou)\s*$/i
if (truncationPatterns.test(response)) {
    return { error: 'TRUNCATED', regenerate: true }
}

// Détection d'artifacts
if (/^\*+$/.test(response) || response.length < 3) {
    return { error: 'ARTIFACT', regenerate: true }
}
```

### 🔥 PRIORITÉ 3: Mémoire Conversationnelle

```typescript
// Dans la DB ou Redis
interface ConversationMemory {
    conversationId: string
    usedPhrases: string[]      // Hash des dernières phrases
    phraseCount: Record<string, number>  // Compteur par phrase
    errorStreak: number
    lastValidResponse: string
}

// Avant génération, injecter:
const forbiddenPhrases = memory.usedPhrases
  .filter(p => memory.phraseCount[p] > 2)

prompt += `\n⚠️ INTERDIT de dire: ${forbiddenPhrases.join(', ')}`
```

### 🔥 PRIORITÉ 4: Validation Bloquante

Rendre le supervisor bloquant:
```typescript
// AU LIEU DE:
supervisorOrchestrator.analyzeResponse(context)  // fire & forget

// FAIRE:
const validation = await supervisorOrchestrator.validateBlocking(context)
if (!validation.isValid) {
    return regenerateWithConstraints(validation.issues)
}
```

---

## 🧪 TESTS DE REPRODUCTION

Les tests complets sont dans: `tests/swarm-bug-analysis.test.ts`

Exécuter:
```bash
npm test -- tests/swarm-bug-analysis.test.ts
```

---

## 📋 CHECKLIST DE CORRECTION

- [ ] Augmenter max_tokens à 150
- [ ] Baisser temperature à 0.4
- [ ] Augmenter frequency_penalty à 0.6
- [ ] Ajouter détection de répétition exacte (validation-node)
- [ ] Ajouter détection de troncature (validation-node)
- [ ] Ajouter détection d'artifacts (validation-node)
- [ ] Implémenter mémoire conversationnelle
- [ ] Rendre validation bloquante
- [ ] Ajouter tests de régression

---

## 🔮 LONG TERME: Architecture Sentinel

Une fois les hotfixes déployés, envisager le système Sentinel:
- Cache des erreurs par conversation
- Validator externe (Claude Haiku) pour validation croisée
- Meta-learning des patterns d'erreur
- Auto-correction incrémentale

---

**Rapport généré par**: Kimi Code CLI  
**Basé sur**: Analysis du code swarm + captures d'écran utilisateur
