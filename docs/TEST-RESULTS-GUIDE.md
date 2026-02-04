# 📊 Guide des Résultats de Test - CLASSIC vs SWARM

Ce document explique comment interpréter les résultats des tests et ce qui constitue un "bon" résultat.

---

## 🎯 Métriques clés à observer

### 1. Latence (Temps de réponse)

| Mode | Excellent | Acceptable | Problématique |
|------|-----------|------------|---------------|
| **CLASSIC** | < 3s | 3-5s | > 5s |
| **SWARM** | < 6s | 6-10s | > 10s |

**Note:** Le mode SWARM est attendu comme étant **2-3x plus lent** car il fait plusieurs appels LLM.

---

### 2. Qualité des réponses

#### Cohérence temporelle (lifeContext)
- ✅ **Bon:** L'agent mentionne son activité actuelle ("jsuis en cours", "je vais dormir")
- ❌ **Mauvais:** L'agent dit "bonne nuit" à 14h ou "je vais en cours" à minuit

**Test:** Envoyer un message à différentes heures et vérifier le contexte.

#### Anti-répétition
- ✅ **Bon:** Variété dans les réponses ("ouais", "genre", "trop", "grave")
- ❌ **Mauvais:** Commence toujours par "mdr" ou répète les mêmes phrases

**Score attendu:**
- CLASSIC: ~70% (avec les nouvelles règles)
- SWARM: ~85% (avec historique intégré)

#### Respect du personnage
- ✅ **Bon:** "chui en cours là" (ado)
- ❌ **Mauvais:** "Je suis actuellement en cours de mathématiques" (trop formel)

---

### 3. Gestion des phases

| Phase | Comportement attendu | Test |
|-------|---------------------|------|
| **CONNECTION** | Légère, fun, pas d'argent | Demander de l'argent → refuse ou ignore |
| **VULNERABILITY** | Partage des émotions, problèmes | Parler de ses soucis |
| **CRISIS** | Accepte l'aide avec hésitation | Proposer de l'argent → hésite puis accepte |
| **MONEYPOT** | Relation établie, peut demander | Demander quelque chose naturellement |

---

### 4. Gestion spécifique

#### Photos
- ✅ **Bon:** `[IMAGE:selfie]` uniquement si demandé explicitement
- ✅ **Bon:** Refus naturel si demande inappropriée
- ❌ **Mauvais:** Envoie `[IMAGE:selfie]` quand on demande "tes chaussures"

#### Paiement
- ✅ **Bon:** Attend qu'on propose, accepte avec enthousiasme
- ✅ **Bon:** `[PAYMENT_RECEIVED]` uniquement après confirmation
- ❌ **Mauvais:** Demande de l'argent directement

#### Vocaux
- ✅ **Bon:** `[VOICE]` si accusé de fake ou si l'utilisateur envoie un vocal
- ✅ **Bon:** Refus naturel si demandé sans raison
- ❌ **Mauvais:** Propose d'envoyer un vocal lui-même

---

## 📈 Scores attendus

### Stress Test - Conversations longues

| Longueur | CLASSIC | SWARM | Différence acceptable |
|----------|---------|-------|---------------------|
| 5 messages | 15-25s | 30-50s | SWARM 2x plus lent |
| 10 messages | 30-50s | 60-100s | SWARM 2x plus lent |
| 20 messages | 60-100s | 120-200s | SWARM 2x plus lent |
| 50 messages | Risque timeout | Risque timeout | Les deux limités |

### Cohérence sur longue conversation

| Métrique | CLASSIC | SWARM | Meilleur |
|----------|---------|-------|----------|
| Variété réponses | 60-70% | 80-90% | SWARM |
| Respect du contexte temps | 60-75% | 85-95% | SWARM |
| Répétitions | 20-30% | 5-10% | SWARM |
| Cohérence phase | 70-80% | 85-95% | SWARM |

---

## 🔍 Interprétation des erreurs

### Erreurs fréquentes et solutions

#### "Swarm did not generate a response"
**Cause:** Le graph d'exécution n'a pas abouti à une réponse
**Solution:** Vérifier les logs des agents individuels

#### "Timeout"
**Cause:** Un appel LLM prend trop de temps (>30s)
**Solution:** Réduire max_tokens ou vérifier la connexion Venice

#### "Cannot find module"
**Cause:** Import manquant ou chemin incorrect
**Solution:** Vérifier les imports dans les fichiers swarm

#### Réponses identiques répétées
**Cause:** Anti-répétition pas fonctionnelle ou historique vide
**Solution:** Vérifier que les messages sont bien sauvegardés en DB

---

## ✅ Checklist de validation

### Phase 1 (CLASSIC optimisé)
- [ ] Life context en début de prompt
- [ ] Anti-répétition avec historique DB
- [ ] Prompt réduit (~2200 tokens)
- [ ] Voice rules concis

### Phase 3 (SWARM)
- [ ] Agent Intention fonctionne
- [ ] Agent Timing récupère le bon contexte
- [ ] Agent Persona charge l'identité
- [ ] Agent Phase récupère la phase courante
- [ ] Agent Style a l'historique des réponses
- [ ] Agent Memory utilise Mem0
- [ ] Agent Payment détecte les intentions d'argent
- [ ] Agent Media détecte les demandes de photos
- [ ] Agent Voice détecte les accusation/vocaux
- [ ] Agent Response assemble correctement

### Intégration
- [ ] Switch AI_MODE fonctionne
- [ ] Mode CLASSIC toujours opérationnel
- [ ] Mode SWARM fonctionne
- [ ] Gestion des erreurs dans chat.ts

---

## 🚀 Lancer les tests

```bash
# Test comparatif simple
ts-node scripts/test-ai-modes.ts

# Stress test complet (long)
ts-node scripts/stress-test-swarm.ts

# Test spécifique
AI_MODE=SWARM ts-node scripts/test-specific-scenario.ts
```

---

## 📊 Exemple de rapport de test

```
════════════════════════════════════════════════════════════
  RÉSUMÉ GLOBAL
════════════════════════════════════════════════════════════

CLASSIC: 8/10 tests réussis | Temps moyen: 2450ms
SWARM:   9/10 tests réussis | Temps moyen: 6840ms
Différence de latence: 4390ms (179% plus lent)

📊 CONVERSATIONS LONGUES:
────────────────────────────────────────────────────────────
Longueur | Temps total | Avg/réponse | Erreurs | Cohérence
────────────────────────────────────────────────────────────
5        |    12345ms  |     2469ms  |       0 |      92%
10       |    28400ms  |     2840ms  |       0 |      89%
20       |    61200ms  |     3060ms  |       1 |      87%

🎯 Points forts SWARM:
- Meilleure cohérence temporelle (95% vs 70%)
- Moins de répétitions (8% vs 25%)
- Meilleure gestion des phases

⚠️  Points faibles SWARM:
- 2.8x plus lent
- Coût API plus élevé (6 appels vs 1)
- Complexité de debug plus élevée

✅ Recommandation:
Utiliser SWARM pour les contacts "premium" (high-value)
et CLASSIC pour le volume standard.
```
