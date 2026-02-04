# 📊 Sources de données des Agents Spécialisés

Ce document détaille précisément **d'où** chaque agent spécialisé récupère ses informations.

---

## 🎯 Vue d'ensemble des Agents

```
┌─────────────────────────────────────────────────────────────────┐
│                         AGENT SWARM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    Données: Message utilisateur + Historique  │
│  │  INTENTION   │    Source: Paramètre d'entrée                 │
│  └──────────────┘                                               │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PARALLEL AGENTS (Contexte)                   │   │
│  ├──────────┬──────────┬──────────┬──────────┬─────────────┤   │
│  │ TIMING   │ PERSONA  │  STYLE   │  PHASE   │   MEMORY    │   │
│  │(toujours)│(toujours)│(toujours)│(si besoin)│(si besoin)  │   │
│  └──────────┴──────────┴──────────┴──────────┴─────────────┘   │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              CONDITIONAL AGENTS (Spécifiques)             │   │
│  ├──────────────┬──────────────┬────────────────────────────┤   │
│  │   PAYMENT    │    MEDIA     │        VOICE               │   │
│  │ (si argent)  │ (si photo)   │   (si vocal/accusation)    │   │
│  └──────────────┴──────────────┴────────────────────────────┘   │
│         ↓                                                        │
│  ┌──────────────┐    Assemble tous les contextes                 │
│  │   RESPONSE   │    Génère la réponse finale                    │
│  └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Détail par Agent

### 1️⃣ AGENT "INTENTION" (`intention-node.ts`)

**Rôle:** Détecter ce que veut l'utilisateur

**Source des données:**
- **Input direct:** Message utilisateur (paramètre `userMessage`)
- **Historique:** 10 derniers messages (paramètre `history`)
- **Analyse:** Appel LLM à Venice pour classification

**Output:**
```typescript
{
  intention: 'paiement' | 'photo' | 'vocal' | 'personnel' | 'general',
  besoinMemoire: boolean,    // Besoin d'infos sur le contact?
  besoinTiming: boolean,     // Besoin de l'heure/activité?
  besoinPhase: boolean,      // Besoin de l'état relation?
  confiance: number          // 0.0 - 1.0
}
```

---

### 2️⃣ AGENT "TIMING" (`timing-node.ts`)

**Rôle:** Savoir quelle heure il est et ce que fait l'agent

**Source des données:**
```typescript
// 1. AgentProfile (DB) - ligne 8-12
const profile = await prisma.agentProfile.findUnique({
  where: { agentId },
  select: { timezone: true, locale: true }
})

// 2. personaSchedule (service existant) - ligne 16
const timingContext = personaSchedule.getContextPrompt(
  timezone,      // Ex: "Europe/Paris"
  undefined,     // Date actuelle
  locale         // Ex: "fr-FR"
)
```

**Données récupérées:**
- Timezone de l'agent (`AgentProfile.timezone`)
- Locale (`AgentProfile.locale`)
- Heure actuelle calculée
- Activité en cours (école, dodo, etc.)
- Contraintes temporelles

**Exemple de output:**
```
[CONTEXTE VIE ACTUEL - Mercredi 14:30]:
⚠️ ACTION EN COURS : Tu es en cours de maths.
URGENT : Tu DOIS répondre en prenant compte de ce contexte.
```

---

### 3️⃣ AGENT "PERSONA" (`persona-node.ts`)

**Rôle:** Maintenir l'identité de l'agent (Anaïs/Lena)

**Source des données:**
```typescript
// AgentProfile (DB) - ligne 8-11
const profile = await prisma.agentProfile.findUnique({
  where: { agentId },
  select: { 
    identityTemplate: true,  // "Tu es Anaïs, 15 ans..."
    contextTemplate: true,   // "Tu habites en banlieue..."
    missionTemplate: true    // "Ton objectif est..."
  }
})
```

**Données récupérées:**
- `identityTemplate`: Qui est l'agent (nom, âge, caractère)
- `contextTemplate**: Situation familiale, hobbies, vie
- `missionTemplate`: Objectif global

**Exemple de output:**
```
[QUI TU ES]:
Tu es Anaïs, 15 ans, lycéenne en banlieue parisienne (94)...

[TA SITUATION]:
Mère célibataire, grand frère Lucas (19 ans)...

[TA MISSION]:
Ton objectif est de créer de vraies connexions...
```

---

### 4️⃣ AGENT "STYLE" (`style-node.ts`)

**Rôle:** Définir comment parler (ton, longueur, anti-répétition)

**Source des données:**
```typescript
// 1. AgentProfile (DB) - ligne 10-13
const profile = await prisma.agentProfile.findUnique({
  where: { agentId },
  select: { styleRules: true, locale: true }
})

// 2. Message history (DB) - ligne 16-25
const recentMessages = await prisma.message.findMany({
  where: {
    conversation: { contactId },
    sender: 'ai'
  },
  orderBy: { timestamp: 'desc' },
  take: 5
})
```

**Données récupérées:**
- `styleRules`: Règles de style depuis la DB
- Historique des 5 dernières réponses de l'AI (anti-répétition)

**Exemple de output:**
```
[COMMENT PARLER]:
RÈGLES DE STYLE:
- Court (3-8 mots)
- Langage ado: "chui", "t'es", "genre"
- PAS de répétition

🚫 PHRASES DÉJÀ DITES:
- "ouais et toi"
- "jsuis en cours"
```

---

### 5️⃣ AGENT "PHASE" (`phase-node.ts`)

**Rôle:** Savoir où en est la relation (CONNECTION → MONEYPOT)

**Source des données:**
```typescript
// 1. AgentContact (DB) - ligne 11-20
const agentContact = await prisma.agentContact.findUnique({
  where: { agentId_contactId: { agentId, contactId } }
})
// Récupère: phase ("CONNECTION"), signals (["RESPONSIVE"])

// 2. AgentProfile (DB) - ligne 22-30
const profile = await prisma.agentProfile.findUnique({
  where: { agentId },
  select: {
    phaseConnectionTemplate: true,
    phaseVulnerabilityTemplate: true,
    phaseCrisisTemplate: true,
    phaseMoneypotTemplate: true
  }
})
```

**Données récupérées:**
- `AgentContact.phase`: Phase actuelle
- `AgentContact.signals`: Signaux comportementaux
- Templates de phase depuis `AgentProfile`

**Exemple de output:**
```
[PHASE ACTUELLE: CRISIS]:
PHASE 3 : CRISE FINANCIÈRE
OBJECTIF: Tu es en galère. Il VEUT t'aider.

Signaux détectés: Réactif, Intéressé, Accro
État relation: En galère mais il veut aider
```

---

### 6️⃣ AGENT "MEMORY" (`memory-node.ts`)

**Rôle:** Rappeler les infos sur le contact

**Source des données:**
```typescript
// Mem0 (service existant) - ligne 10-18
const userId = memoryService.buildUserId(contactId, agentId)

// Recherche pertinente si query fournie
const searchResults = await memoryService.search(
  userId, 
  userMessage,  // Query = message actuel
  5             // Top 5 résultats
)

// Ou récupération brute
const allMemories = await memoryService.getAll(userId)
```

**Données récupérées:**
- Infos extraites par Mem0 sur ce contact
- Recherche sémantique basée sur la question

**Exemple de output:**
```
[INFOS SUR CETTE PERSONNE]:
- Il s'appelle Jean
- Il habite Paris
- Il travaille dans l'informatique
- Il aime le foot
```

---

### 7️⃣ AGENT "PAYMENT" (`payment-node.ts`)

**Rôle:** Gérer tout ce qui concerne l'argent

**Source des données:**
```typescript
// 1. AgentProfile (DB) - ligne 10-18
const profile = await prisma.agentProfile.findUnique({
  where: { agentId },
  select: { 
    paymentRules: true,
    bankAccountNumber: true,
    bankRoutingNumber: true
  }
})

// 2. AgentSettings (DB) - ligne 20
const settings = await settingsService.getAgentSettings(agentId)
// Récupère: paypal, venmo, cashapp, etc.
```

**Données récupérées:**
- `paymentRules`: Règles de paiement
- Méthodes activées (PayPal, Venmo, etc.)
- Identifiants de paiement
- Coordonnées bancaires (si activé)

**Exemple de output:**
```
[PAIEMENT - RÈGLES STRICTES]:
Si on propose de payer → ACCEPTE avec enthousiasme.
Attends confirmation avant [PAYMENT_RECEIVED].

MÉTHODES DISPONIBLES:
- PayPal: anais.du.94@gmail.com
- Bank: Account 647328586232728

FORMAT: Donne UNIQUEMENT le username quand on demande.
```

---

### 8️⃣ AGENT "MEDIA" (`media-node.ts`)

**Rôle:** Gérer les demandes de photos/vidéos

**Source des données:**
```typescript
// AgentProfile (DB) - ligne 10-13
const profile = await prisma.agentProfile.findUnique({
  where: { agentId },
  select: { locale: true }
})

// Analyse locale du message (pas d'appel DB)
const msg = state.userMessage.toLowerCase()
// Détection: "selfie", "photo", "pieds", "chat", etc.
```

**Données récupérées:**
- Locale (pour langue des règles)
- **Pas de DB** - analyse textuelle pure

**Exemple de output:**
```
[PHOTOS - RÈGLES ABSOLUES]:
- [IMAGE:xxx] UNIQUEMENT si on demande EXPLICITEMENT
- Photos dispo: selfie, face, pieds, chat, chien...
- INTERDICTION DE SUBSTITUTION

DEMANDE DÉTECTÉE: "selfie"
```

---

### 9️⃣ AGENT "VOICE" (`voice-node.ts`)

**Rôle:** Gérer les messages vocaux

**Source des données:**
```typescript
// 1. AgentProfile (DB) - ligne 10-13
const profile = await prisma.agentProfile.findUnique({
  where: { agentId },
  select: { locale: true }
})

// 2. AgentSettings (DB) - ligne 16
const settings = await settingsService.getAgentSettings(agentId)
const voiceEnabled = settings['voice_response_enabled'] === 'true'

// 3. State (paramètre) - ligne 19-21
const isVoiceReceived = state.lastMessageType === 'voice'
const isAccused = msg.includes('fake') || msg.includes('bot')
```

**Données récupérées:**
- `voice_response_enabled`: Setting activé ou non
- Type du dernier message (voice/ptt)
- Détection accusation (fake/bot)

**Exemple de output:**
```
[VOCAUX - CAPACITÉ ACTIVÉE]:
- Tu PEUX envoyer des vocaux (tag [VOICE])
- OBLIGATOIRE si: 1) Il t'envoie un vocal
                 2) Il t'accuse de fake

SITUATION ACTUELLE:
- Il vient de t'envoyer un VOCAL → TU DOIS RÉPONDRE PAR VOCAL
```

---

### 🔟 AGENT "RESPONSE" (`response-node.ts`)

**Rôle:** Assembler tout et générer la réponse finale

**Source des données:**
```typescript
// 1. Tous les contextes des agents précédents (paramètre state.contexts)
const contexts = {
  timing: "...",   // De timing-node
  persona: "...",  // De persona-node
  style: "...",    // De style-node
  phase: "...",    // De phase-node
  memory: "...",   // De memory-node (optionnel)
  payment: "...",  // De payment-node (optionnel)
  media: "...",    // De media-node (optionnel)
  voice: "..."     // De voice-node (optionnel)
}

// 2. Historique complet (paramètre state.history)
const history: Message[]

// 3. Message actuel (paramètre state.userMessage)
const userMessage: string

// 4. Venice (génération finale) - ligne 28-35
const response = await venice.chatCompletion(
  systemPrompt,  // Assemblage de tous les contexts
  history,
  userMessage,
  { model, temperature: 0.7, max_tokens: 500 }
)
```

---

## 📊 Récapitulatif des Sources

| Agent | DB Primaire | Service Externe | Données clés |
|-------|-------------|-----------------|--------------|
| **Intention** | - | Venice LLM | Classification du message |
| **Timing** | `AgentProfile` | `personaSchedule` | Timezone, heure, activité |
| **Persona** | `AgentProfile` | - | Identity, context, mission |
| **Style** | `AgentProfile` + `Message` | - | Règles + historique réponses |
| **Phase** | `AgentContact` + `AgentProfile` | - | Phase, signals, templates |
| **Memory** | - | `memoryService` (Mem0) | Infos sur le contact |
| **Payment** | `AgentProfile` + `AgentSetting` | - | Règles + méthodes de paiement |
| **Media** | `AgentProfile` (locale) | - | Règles photos (analyse texte) |
| **Voice** | `AgentProfile` + `AgentSetting` | - | Setting vocal + détection type |
| **Response** | - | `venice` | Assemblage + génération finale |

---

## 🔄 Flux de données complet

```
Message utilisateur
        ↓
┌───────────────┐
│   INTENTION   │ ← Message + Historique (params)
└───────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│                    PARALLEL FETCH                        │
├─────────────────────────────────────────────────────────┤
│  TIMING    │ DB: AgentProfile.timezone                 │
│            │ Service: personaSchedule.getContextPrompt │
├────────────┼───────────────────────────────────────────┤
│  PERSONA   │ DB: AgentProfile.identityTemplate         │
│            │ DB: AgentProfile.contextTemplate          │
│            │ DB: AgentProfile.missionTemplate          │
├────────────┼───────────────────────────────────────────┤
│  STYLE     │ DB: AgentProfile.styleRules               │
│            │ DB: Message (5 derniers)                  │
├────────────┼───────────────────────────────────────────┤
│  PHASE     │ DB: AgentContact.phase                    │
│            │ DB: AgentContact.signals                  │
│            │ DB: AgentProfile.phase*Template           │
├────────────┼───────────────────────────────────────────┤
│  MEMORY    │ Service: memoryService.search/getAll      │
├────────────┼───────────────────────────────────────────┤
│  PAYMENT   │ DB: AgentProfile.paymentRules             │
│            │ DB: AgentSetting (paypal, venmo...)       │
├────────────┼───────────────────────────────────────────┤
│  MEDIA     │ DB: AgentProfile.locale                   │
│            │ Analyse: userMessage (texte)              │
├────────────┼───────────────────────────────────────────┤
│  VOICE     │ DB: AgentSetting.voice_response_enabled   │
│            │ Param: lastMessageType                    │
└────────────┴───────────────────────────────────────────┘
        ↓
┌───────────────┐
│   RESPONSE    │ ← Assemble tous les contexts + Venice
└───────────────┘
        ↓
   Réponse finale
```

---

## ⚡ Optimisations

1. **Parallélisation:** Les agents TIMING, PERSONA, STYLE, PHASE, MEMORY s'exécutent en parallèle avec `Promise.all()`

2. **Lazy loading:** PAYMENT, MEDIA, VOICE ne s'exécutent que si nécessaire (selon l'intention détectée)

3. **Caching:** Les settings sont récupérés une fois et réutilisés

4. **Recherche sémantique:** Mem0 permet de trouver les memories pertinentes sans tout charger
