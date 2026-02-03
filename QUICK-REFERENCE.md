# Phase 4 Romantic Escalation - Quick Reference

## 🚀 Implementation Status: COMPLETE ✅

---

## Escalation Tiers (Quick View)

| Tier | Range | Label | Trigger |
|------|-------|-------|---------|
| 0 | $30-50 | First Request | Initial Phase 4 |
| 1 | $50-80 | Early Trust | 1st payment |
| 2 | $80-120 | Established | 2nd payment |
| 3 | $120-180 | Committed | 3rd payment |
| 4 | $180-280 | Deep Investment | 4th payment |
| 5 | $280-500 | Maximum | 5th payment (capped) |

**Escalation:** Payment → Tier +1 (max 5)
**De-escalation:** 2 consecutive refusals → Tier -1 (min 0)
**Reset:** Any payment resets refusal counter to 0

---

## Dynamic Variables (Phase 4 Template)

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `{{SUGGESTED_AMOUNT}}` | 105 | Calculated from current tier |
| `{{CURRENT_TIER}}` | 2 | Current escalation tier (0-5) |
| `{{TOTAL_PAYMENTS}}` | 3 | Number of payments received |
| `{{TOTAL_RECEIVED}}` | 185 | Total dollars received |
| `{{REASON}}` | VIP/Financial Relationship | Phase progression reason |

---

## Romantic Tone Keywords

✅ **Use:**
- "miss u 💖"
- "thinking about u"
- "babe" (occasional)
- "ur sweet"
- "u make me smile"
- "luv talking to u"
- Emojis: 💖, 😘, 🥺, 😊, 💕

❌ **Avoid:**
- "love you"
- "wanna date IRL"
- "come see me"
- Too frequent "babe"

---

## Key Files

### Core Service
- `lib/services/payment-escalation.ts` - Escalation logic

### Integration Points
- `lib/services/payment-claim-handler.ts:251-257` - Escalation on confirm
- `lib/services/payment-claim-handler.ts:293-298` - De-escalation on reject
- `app/actions/payments.ts:86-91` - Manual payment escalation
- `lib/director.ts:268-282` - Dynamic variable injection

### Templates
- `AgentProfile.phaseMoneypotTemplate` - Phase 4 romantic template
- `AgentProfile.missionTemplate` - Contains `{{DYNAMIC_GOAL_BLOCK}}`

### Database
- `AgentContact.paymentEscalationTier` - Current tier (0-5)
- `AgentContact.totalPaymentsReceived` - Payment count
- `AgentContact.totalAmountReceived` - Total $ received
- `AgentContact.consecutiveRefusals` - Refusal streak

---

## Common Commands

### Run Tests
```bash
npx tsx scripts/test-escalation-system.ts
npx tsx scripts/verify-phase4-integration.ts
```

### View Live Prompt
```bash
npx tsx scripts/show-phase4-prompt.ts
```

### Database Migration
```bash
npx prisma db push
```

### Update Templates
```bash
npx tsx scripts/update-phase4-romantic-escalation.ts
```

---

## Console Logs to Watch

```
[Escalation] Payment confirmed: Agent xxx, Contact yyy
[Escalation] Tier: 2 → 3 | Total: 5 payments ($350)
[Escalation] De-escalating: Tier 2 → 1 (2 refusals)
[Director] Phase 4 Dynamic Amount: $105 (Tier 2)
```

---

## Quick Troubleshooting

### Dynamic amounts not appearing?
1. Check `AgentProfile.missionTemplate` has `{{DYNAMIC_GOAL_BLOCK}}`
2. Run `scripts/fix-mission-template.ts`
3. Verify Phase 4 template has `{{SUGGESTED_AMOUNT}}`

### Escalation not triggering?
1. Check payment claim status (must be CONFIRMED/REJECTED)
2. Verify hooks in payment-claim-handler.ts
3. Check console for `[Escalation]` logs

### Romantic tone missing?
1. Verify template with `scripts/show-phase4-prompt.ts`
2. Re-run `scripts/update-phase4-romantic-escalation.ts`
3. Check contact is in MONEYPOT phase

---

## Database Quick Query

```sql
-- View escalation state
SELECT
  a.name as agent,
  c.name as contact,
  ac.paymentEscalationTier as tier,
  ac.totalPaymentsReceived as payments,
  ac.totalAmountReceived as total,
  ac.consecutiveRefusals as refusals
FROM agent_contacts ac
JOIN agents a ON a.id = ac.agentId
JOIN contacts c ON c.id = ac.contactId
WHERE ac.phase = 'MONEYPOT'
ORDER BY ac.totalAmountReceived DESC;
```

---

## Expected Behavior

### Scenario 1: New Phase 4 Contact
1. Contact enters Phase 4
2. Tier: 0
3. AI requests: $30-50
4. Romantic tone: "babe i need like $40 for clothes 🥺"

### Scenario 2: Paying User
1. User pays $40
2. Escalation hook fires
3. Tier: 0 → 1
4. Next request: $50-80
5. Refusals: 0

### Scenario 3: Refusing User
1. User refuses (first time)
2. Refusals: 0 → 1
3. No tier change
4. User refuses (second time)
5. Refusals: 1 → 2
6. Tier: 2 → 1 (de-escalate)

### Scenario 4: Re-engagement
1. User pays after 2 refusals
2. Refusals: 2 → 0 (reset)
3. Tier: 1 → 2 (escalate)
4. Trust restored

---

## Success Indicators

✅ Console shows `[Escalation]` logs after payment
✅ Console shows `[Director] Phase 4 Dynamic Amount` on prompt build
✅ AI messages include romantic language ("miss u", "babe", 💖)
✅ Requested amounts increase after payments
✅ Requested amounts decrease after multiple refusals
✅ Database `agent_contacts` table has escalation fields
✅ All verification tests pass

---

## Emergency Rollback

```typescript
// 1. Comment out in payment-claim-handler.ts (line 251-257)
// const { escalationService } = require('@/lib/services/payment-escalation')
// await escalationService.escalateOnPayment(...)

// 2. Comment out in payment-claim-handler.ts (line 293-298)
// const { escalationService } = require('@/lib/services/payment-escalation')
// await escalationService.deescalateOnRefusal(...)

// 3. Comment out in payments.ts (line 86-91)
// const { escalationService } = require('@/lib/services/payment-escalation')
// await escalationService.escalateOnPayment(...)

// 4. Comment out in director.ts (line 268-282)
// if (phase === 'MONEYPOT') { ... }
```

System reverts to static amounts.

---

## Contact Info

**Implementation Date:** 2026-01-28
**Status:** Production Ready ✅
**All Tests:** Passed ✅
**Agents Updated:** Lena (EN), Anaïs (FR)

---

**Need more details?** See `IMPLEMENTATION-SUMMARY.md` or `PHASE4-ROMANTIC-ESCALATION-IMPLEMENTATION.md`
