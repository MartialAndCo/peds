# AI Queue Awareness Plan

## Problem
When messages are queued (delayed responses) and the user sends new messages before the queued response is sent, it creates discordance - AI responds to old context while new messages exist.

## Solution
Make the AI **aware** of the queue and let her **decide** what to do with pending messages.

---

## Proposed Logic

### When new message arrives:
1. **Fetch pending messages** for this conversation from `messageQueue`
2. **Inject** them into AI context: `[PENDING_QUEUE: id=X, content="...", type="text/voice"]`
3. **AI decides** via special tokens:
   - `[CANCEL:id]` → Delete that queued message
   - `[KEEP:id]` → Keep it scheduled
   - No token → AI generates new response that supersedes old

### Priority Rules:
- **Voice messages** are priority → AI should rarely cancel them
- If new message makes old response irrelevant → AI should cancel

---

## Changes Required

### [MODIFY] `lib/handlers/chat.ts`
Before AI generation:
1. Query `messageQueue` for `PENDING` messages in this conversation
2. Format them as context block in system prompt
3. Parse AI response for `[CANCEL:id]` tokens
4. Execute cancellations before sending new response

### [NEW] Queue Context in System Prompt
```
[PENDING_MESSAGES]
- ID:42 (Text, scheduled 22:30): "Ouais c'est vrai mdr"
- ID:43 (Voice, scheduled 22:32): [Voice Message]
[/PENDING_MESSAGES]

Tu as des messages en attente d'envoi. Si le nouveau message du lead rend certains obsolètes, utilise [CANCEL:ID] pour les supprimer.
```

### AI Response Example
```
[CANCEL:42]
Ah oui t'as raison, j'avais pas vu ton dernier message lol
```
→ System cancels queue item 42, sends only new response

---

## Verification
- [ ] AI sees pending messages in context
- [ ] AI can cancel obsolete messages with [CANCEL:id]
- [ ] Voice messages are preserved unless explicitly canceled
- [ ] Race conditions handled properly
