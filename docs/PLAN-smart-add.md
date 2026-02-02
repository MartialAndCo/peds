# Smart Add Feature Plan

## Goal
Add a "Smart Add" button on the Contacts page that lets the admin paste a raw conversation, have AI extract key info (name, age, location, etc.), then create the lead contact with that AI-generated context.

**Purpose**: The AI takes over the conversation seamlessly, as if it was her from the beginning. She knows everything that was discussed and can continue naturally.

---

## User Flow

1. Admin clicks **"Smart Add"** button on `/workspace/[agentId]/contacts`
2. Modal opens with:
   - **Phone** input (required)
   - **Platform** input (text, e.g. "Instagram", "Telegram")
   - **Conversation** textarea (paste raw chat text)
3. Admin submits → AI analyzes conversation → generates unified context
4. Contact created with `source: 'smart_add'`, context in `notes`
5. Conversation created with `WAITING_FOR_LEAD` state
6. When lead messages on WhatsApp, AI continues seamlessly

---

## Proposed Changes

### 1. New API Endpoint

#### [NEW] `app/api/contacts/smart-add/route.ts`
- **Input**: `{ phone: string, platform: string, conversation: string, agentId: string }`
- **Process**:
  1. Call AI to analyze and generate **one unified context paragraph**
  2. Create Contact with AI-generated context in `notes`
  3. Create Conversation with `WAITING_FOR_LEAD` state
- **Output**: `{ contact, generatedContext }`

---

### 2. AI Prompt for Context Generation

**Language**: Fetched from `AgentProfile.locale` (fr-FR → French, en-US → English)

#### French Prompt (locale = fr-FR)
```text
Tu es une ado de 15 ans. Tu vas reprendre cette conversation sur WhatsApp.
Génère UN SEUL paragraphe de contexte (max 200 mots) à retenir pour continuer naturellement. Inclus:
- Son prénom/surnom
- Son âge si mentionné
- D'où il vient
- Ses hobbies/intérêts
- Tout ce qui est important
- Plateforme d'origine: {PLATFORM}

Retourne UNIQUEMENT le paragraphe, pas de JSON.

Conversation:
{CONVERSATION_TEXT}
```

#### English Prompt (locale = en-US)
```text
You are a 15 year old girl. You will continue this conversation on WhatsApp.
Generate ONE paragraph of context (max 200 words) to remember for a seamless continuation. Include:
- Their name/nickname
- Their age if mentioned
- Where they're from
- Their hobbies/interests
- Anything important
- Original platform: {PLATFORM}

Return ONLY the paragraph, no JSON.

Conversation:
{CONVERSATION_TEXT}
```

---

### 3. UI Changes

#### [MODIFY] `app/workspace/[agentId]/contacts/page.tsx`
- Add "Smart Add" button next to existing "Add Contact"
- Open `SmartAddDialog` component on click

#### [NEW] `components/contacts/smart-add-dialog.tsx`
- Phone input
- Conversation textarea (multiline paste)
- Loading state while AI processes
- Preview of extracted data before confirmation

---

## Technical Notes

- Reuse existing Contact creation logic from `api/contacts/route.ts`
- Use Venice AI (same as chat) for extraction
- Keep AI prompt simple, return JSON only
- Phone normalization same as Lead Provider (`lib/leads.ts`)

---

## Verification

- [ ] "Smart Add" button visible on Contacts page
- [ ] Paste conversation → AI extracts name/age/location
- [ ] Contact created with correct `notes` and `source`
- [ ] Conversation in `WAITING_FOR_LEAD` state
- [ ] First real message from lead triggers AI response with context

---

## Files to Create/Modify

| Action | File |
|--------|------|
| NEW | `app/api/contacts/smart-add/route.ts` |
| NEW | `components/contacts/smart-add-dialog.tsx` |
| MODIFY | `app/workspace/[agentId]/contacts/page.tsx` |
