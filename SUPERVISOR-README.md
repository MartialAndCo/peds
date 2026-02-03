# 🤖 Supervisor AI - Documentation

Système de supervision multi-agents pour la santé des IA dans PedsAI.

---

## 📋 Architecture

### 4 Agents Spécialisés

| Agent | Rôle | Détecte |
|-------|------|---------|
| **CoherenceAgent** | Cohérence IA | System leaks, répétitions, hallucinations, rupture de persona |
| **ContextAgent** | Contexte conversation | Perte de contexte, réponses hors sujet, sauts de sujet |
| **PhaseAgent** | Transitions de phase | Changements de phase trop rapides, speedrun suspect (avec discernement paiement) |
| **ActionAgent** | Actions IA | Photos sans demande, [IMAGE] inapproprié, vocaux sans trigger |

### Orchestrateur

Le `supervisorOrchestrator` coordonne les 4 agents :
- Exécute les analyses en parallèle
- Gère les alertes CRITICAL immédiatement (pause auto + notification)
- Batch les autres alertes (5-10 min)
- Crée des notifications dans le système existant
- Met en pause automatiquement les conversations en cas de CRITICAL

---

## 🚨 Niveaux d'Alerte

```
🔴 CRITICAL  → Pause auto + Notification immédiate + Dashboard
🟠 HIGH      → Dashboard + Notification batch (5-10 min)
🟡 MEDIUM    → Dashboard uniquement
🔵 LOW       → Dashboard (info)
```

### Alertes CRITICAL (Pause Auto)

- **SYSTEM_LEAK** : L'IA révèle son prompt/system
- **UNREQUESTED_IMAGE_TAG** : [IMAGE] utilisé sans demande explicite
- **UNREQUESTED_PHOTO** : Photo envoyée sans raison

---

## 📁 Structure des Fichiers

```
lib/services/supervisor/
├── types.ts              # Types TypeScript
├── coherence-agent.ts    # Agent cohérence
├── context-agent.ts      # Agent contexte
├── phase-agent.ts        # Agent phases
├── action-agent.ts       # Agent actions
├── orchestrator.ts       # Orchestrateur principal
└── index.ts              # Exports

app/api/supervisor/
└── route.ts              # API routes (GET, PATCH, POST)

app/admin/supervisor/
├── page.tsx              # Dashboard (Server Component)
└── client.tsx            # Dashboard interactif (Client Component)
```

---

## 🗄️ Base de Données

### Table `supervisor_alerts`

```prisma
model SupervisorAlert {
  id              String   @id @default(uuid())
  agentId         String
  conversationId  Int
  contactId       String?
  agentType       String   // 'COHERENCE', 'CONTEXT', 'PHASE', 'ACTION'
  alertType       String   // 'REPETITION', 'SYSTEM_LEAK', etc.
  severity        String   // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  title           String
  description     String
  evidence        Json     // Données structurées
  status          String   @default("NEW")
  adminNotes      String?
  autoPaused      Boolean  @default(false)
  createdAt       DateTime @default(now())
}
```

---

## 🔧 Intégration

### Hook dans chat.ts

Le supervisor est appelé après chaque génération de réponse IA :

```typescript
// Dans lib/handlers/chat.ts après génération de responseText
const { supervisorOrchestrator } = require('@/lib/services/supervisor')

supervisorOrchestrator.analyzeResponse({
    agentId: effectiveAgentId,
    conversationId: conversation.id,
    contactId: contact.id,
    userMessage: lastContent,
    aiResponse: responseText,
    history: contextMessages,
    phase: phase
}).catch(console.error)
```

### Dashboard

Accessible via `/admin/supervisor` :
- Vue d'ensemble des alertes par gravité
- Santé des agents en temps réel
- Filtres par type/statut
- Actions : Investiguer, Résolu, Faux positif
- Lien vers les conversations concernées

---

## 🚀 Démarrage

### 1. Appliquer la migration Prisma

```bash
npx prisma migrate dev --name add_supervisor_alerts
npx prisma generate
```

### 2. Redémarrer le serveur

Le supervisor est actif dès le redémarrage.

---

## 📊 Monitoring

### Dashboard Admin

URL : `/admin/supervisor`

Fonctionnalités :
- **Stats Cards** : Nombre d'alertes par gravité
- **Agent Health** : État de santé de chaque agent
- **Liste des alertes** : Filtrable, expandable
- **Actions rapides** : Investiguer, Résolu, Faux positif

### API

```
GET  /api/supervisor?severity=CRITICAL&status=NEW
PATCH /api/supervisor { alertId, status, adminNotes }
POST /api/supervisor { action: "flush" }
```

---

## 🎯 Cas d'Usage

### Exemple 1 : Photo sans demande

1. L'IA génère : `[IMAGE:selfie] tiens 😘`
2. ActionAgent détecte : Pas de demande de photo dans le message utilisateur
3. Alerte CRITICAL créée
4. Conversation auto-paused
5. Notification envoyée au dashboard + PWA

### Exemple 2 : Répétition excessive

1. L'IA répète "mdr ouais" 10 fois
2. CoherenceAgent détecte le pattern
3. Alerte HIGH créée
4. Dashboard mis à jour (batch 5 min)

### Exemple 3 : Speedrun avec paiement

1. Utilisateur passe de CONNECTION → MONEYPOT en 3 min
2. PhaseAgent vérifie : Paiement de $50 confirmé
3. Alerte LOW (info seulement)
4. Dashboard indique "Whale detected"

---

## ⚙️ Configuration

### Variables d'environnement

Aucune nouvelle variable requise. Le supervisor utilise :
- `VENICE_API_KEY` pour les analyses IA
- Système de notifications existant

### Modèles Venice

- **Tâches simples** : `venice-uncensored` (détection mécanique)
- **Analyses complexes** : `llama-3.3-70b` (coherence, contexte)

---

## 🔄 Flux de Données

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  Message    │────▶│    IA       │────▶│  ResponseText   │
│  Utilisateur│     │  Génération │     │                 │
└─────────────┘     └─────────────┘     └─────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────┐
│              SUPERVISOR ORCHESTRATOR                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Coherence │ │ Context  │ │  Phase   │ │  Action  │   │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       └─────────────┴─────────────┴─────────────┘        │
│                         │                                │
│                         ▼                                │
│              ┌──────────────────────┐                    │
│              │  Triage & Priorité   │                    │
│              └──────────┬───────────┘                    │
│                         │                                │
│            ┌────────────┼────────────┐                   │
│            ▼            ▼            ▼                   │
│      ┌─────────┐  ┌──────────┐  ┌──────────┐            │
│      │CRITICAL │  │  HIGH/   │  │    -     │            │
│      │  +Pause │  │  MEDIUM  │  │  (rien)  │            │
│      │Notif    │  │  Batch   │  │          │            │
│      └─────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────┘
            │            │
            ▼            ▼
    ┌──────────────┐ ┌──────────────┐
    │ Notification │ │   Dashboard  │
    │    PWA       │ │   /admin/sv  │
    └──────────────┘ └──────────────┘
```

---

## 📝 Notes

- Les analyses sont **non-bloquantes** (fire-and-forget)
- Le supervisor ne ralentit pas le flux de messages
- Les faux positifs sont marqués mais l'IA continue d'apprendre
- Les conversations auto-paused peuvent être relancées manuellement

---

## 🔮 Futures Améliorations

- [ ] Apprentissage automatique des faux positifs
- [ ] Dashboard temps réel (WebSocket)
- [ ] Alertes prédictives (tendances)
- [ ] Intégration Discord pour alertes CRITICAL
- [ ] Rapports hebdomadaires automatisés
