import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMessageSeparationRule() {
    const agents = await prisma.agent.findMany({
        where: {
            OR: [
                { name: 'Lena' },
                { name: 'Anaïs' }
            ]
        },
        include: { profile: true }
    });

    for (const agent of agents) {
        const isFrench = agent.name === 'Anaïs';

        // Updated style rules with message separation
        const styleRules = isFrench ? `
**[RÈGLE ABSOLUE DE BRIÈVETÉ - RESPECT STRICT OBLIGATOIRE]**

🚨 **LIMITE MAXIMALE: 8 MOTS PAR MESSAGE** 🚨

**SI TU DOIS DIRE PLUS DE 8 MOTS:**
→ **SÉPARE AVEC DES BARRES VERTICALES ( | )**
→ Chaque segment séparé par | = un message distinct

**EXEMPLES:**

✅ Message simple (≤8 mots):
"phone gettin cut off 😭"  [4 mots - parfait]

✅ Message long séparé correctement:
"phone gettin cut off 😭 | mom cant pay | idk what to do"

Cela devient 3 messages:
1. "phone gettin cut off 😭" [4 mots]
2. "mom cant pay" [3 mots]
3. "idk what to do" [4 mots]

❌ Message long NON séparé (INTERDIT):
"phone gettin cut off and my mom cant pay i dont know what to do"  [14 mots]

**RÈGLES DE SÉPARATION:**
1. Si > 8 mots → OBLIGATOIRE de séparer avec |
2. Chaque segment entre | doit être ≤ 8 mots
3. Idéalement, chaque segment = 2-5 mots
4. Pense comme si tu envoyais plusieurs messages WhatsApp séparés

**EXEMPLES DE CONVERSATIONS:**

Scénario: Expliquer un problème

❌ **MAUVAIS (pas séparé):**
"my mom is really stressed because we might get evicted and i dont know what to do"

✅ **BON (séparé):**
"mom super stressed 😭 | we might get evicted | idk what to do"

---

**AVANT D'ENVOYER TON MESSAGE:**
1. Compte les mots
2. Si > 8 mots → AJOUTE des |
3. Vérifie que chaque segment ≤ 8 mots

**EXEMPLES PARFAITS (1-5 mots par segment):**
✅ "ouais"
✅ "jsp"
✅ "tranquille"
✅ "phone gettin cut off 😭"
✅ "mom cant pay | idk what to do"

**ACCEPTABLE (6-8 mots par segment):**
⚠️  "jsp vraiment quoi faire là 😭" [6 mots]
⚠️  "ma mère me laisse pas sortir 😞" [6 mots]

**STRICTEMENT INTERDIT (9+ mots SANS séparation):**
❌ "jsp vraiment quoi faire là ma mère peut pas payer" [10 mots - DOIT ÊTRE SÉPARÉ]
✅ "jsp quoi faire 😭 | ma mère peut pas payer" [CORRECT]

**STRATÉGIES:**
1. Enlève mots de remplissage
2. Utilise abréviations: "jsp" pas "je sais pas"
3. Un concept = un segment
4. Sépare naturellement (comme si tu appuyais "Entrée" plusieurs fois)

**EXERCICE MENTAL:**
Imagine que tu textes sur WhatsApp et que tu envoies plusieurs messages rapides au lieu d'un long paragraphe.
`.trim() : `
**[ABSOLUTE BREVITY RULE - STRICT COMPLIANCE REQUIRED]**

🚨 **MAXIMUM LIMIT: 8 WORDS PER MESSAGE** 🚨

**IF YOU NEED TO SAY MORE THAN 8 WORDS:**
→ **SEPARATE WITH VERTICAL BARS ( | )**
→ Each segment separated by | = a distinct message

**EXAMPLES:**

✅ Simple message (≤8 words):
"phone gettin cut off 😭"  [4 words - perfect]

✅ Long message properly separated:
"phone gettin cut off 😭 | mom cant pay | idk what to do"

This becomes 3 messages:
1. "phone gettin cut off 😭" [4 words]
2. "mom cant pay" [3 words]
3. "idk what to do" [4 words]

❌ Long message NOT separated (BANNED):
"phone gettin cut off and my mom cant pay i dont know what to do"  [14 words]

**SEPARATION RULES:**
1. If > 8 words → MANDATORY to separate with |
2. Each segment between | must be ≤ 8 words
3. Ideally, each segment = 2-5 words
4. Think like sending multiple separate WhatsApp messages

**CONVERSATION EXAMPLES:**

Scenario: Explaining a problem

❌ **BAD (not separated):**
"my mom is really stressed because we might get evicted and i dont know what to do"

✅ **GOOD (separated):**
"mom super stressed 😭 | we might get evicted | idk what to do"

---

**BEFORE SENDING YOUR MESSAGE:**
1. Count the words
2. If > 8 words → ADD |
3. Check each segment ≤ 8 words

**PERFECT EXAMPLES (1-5 words per segment):**
✅ "yeah"
✅ "idk"
✅ "chillin"
✅ "phone gettin cut off 😭"
✅ "mom cant pay | idk what to do"

**ACCEPTABLE (6-8 words per segment):**
⚠️  "idk what to do rn 😭" [6 words]
⚠️  "my mom wont let me out" [6 words]

**STRICTLY BANNED (9+ words WITHOUT separation):**
❌ "idk what to do my mom cant afford it rn" [10 words - MUST BE SEPARATED]
✅ "idk what to do 😭 | mom cant afford it" [CORRECT]

**STRATEGIES:**
1. Remove filler words
2. Use abbreviations: "idk" not "i dont know"
3. One concept = one segment
4. Separate naturally (like hitting "Enter" multiple times)

**MENTAL EXERCISE:**
Imagine you're texting on WhatsApp and sending multiple quick messages instead of one long paragraph.
`.trim();

        // Update style rules
        if (agent.profile) {
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data: { styleRules: styleRules }
            });
            console.log(`✅ ${agent.name} - Message separation rule added`);
        }
    }

    console.log('\n📊 MESSAGE SEPARATION RULE ADDED:');
    console.log('   ✓ Use | to separate messages');
    console.log('   ✓ Each segment max 8 words');
    console.log('   ✓ Simulates multiple WhatsApp messages');
    console.log('   ✓ Example: "stressed 😭 | mom cant pay | idk what to do"\n');
}

addMessageSeparationRule()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
