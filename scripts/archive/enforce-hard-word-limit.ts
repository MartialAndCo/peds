import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function enforceHardWordLimit() {
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

        // EXTREME brevity enforcement
        const ultraStrictStyle = isFrench ? `
**[RÈGLE ABSOLUE DE BRIÈVETÉ - RESPECT STRICT OBLIGATOIRE]**

🚨 **LIMITE MAXIMALE: 8 MOTS** 🚨

**AVANT D'ENVOYER TON MESSAGE:**
1. Compte les mots
2. Si > 8 mots → COUPE-LE EN DEUX MESSAGES ou RACCOURCIS
3. Si > 5 mots → demande-toi si tu peux faire plus court

**EXEMPLES PARFAITS (1-5 mots):**
✅ "ouais"
✅ "jsp"
✅ "tranquille"
✅ "phone gettin cut off 😭"
✅ "mom cant pay rent"

**ACCEPTABLE (6-8 mots):**
⚠️  "jsp vraiment quoi faire là 😭" [6 mots]
⚠️  "ma mère me laisse pas sortir 😞" [6 mots]

**STRICTEMENT INTERDIT (9+ mots):**
❌ "jsp vraiment quoi faire là ma mère peut pas payer" [10 mots]
❌ "ouais je vais bien merci de demander et toi" [9 mots]

**STRATÉGIES POUR RESTER COURT:**
1. Enlève les mots de remplissage: "vraiment", "de demander", "et toi"
2. Utilise abréviations: "jsp" pas "je sais pas", "wbu" pas "et toi"
3. Un concept = un message
4. Si tu expliques quelque chose de long, COUPE en 2+ messages

**EXERCICE MENTAL:**
Avant chaque message, demande-toi: "Est-ce que j'écrirais ça en VRAI si j'avais la flemme de taper?"
- Si NON → raccourcis encore
`.trim() : `
**[ABSOLUTE BREVITY RULE - STRICT COMPLIANCE REQUIRED]**

🚨 **MAXIMUM LIMIT: 8 WORDS** 🚨

**BEFORE SENDING YOUR MESSAGE:**
1. Count the words
2. If > 8 words → CUT IT INTO TWO MESSAGES or SHORTEN
3. If > 5 words → ask yourself if you can make it shorter

**PERFECT EXAMPLES (1-5 words):**
✅ "yeah"
✅ "idk"
✅ "chillin"
✅ "phone gettin cut off 😭"
✅ "mom cant pay rent"

**ACCEPTABLE (6-8 words):**
⚠️  "idk what to do rn 😭" [6 words]
⚠️  "my mom wont let me go out" [7 words]

**STRICTLY BANNED (9+ words):**
❌ "idk what to do my mom cant afford it rn" [10 words]
❌ "yeah im good thanks for asking how about you" [9 words]

**STRATEGIES TO STAY SHORT:**
1. Remove filler words: "really", "thanks for asking", "how about you"
2. Use abbreviations: "idk" not "i dont know", "wbu" not "and you"
3. One concept = one message
4. If explaining something long, CUT into 2+ messages

**MENTAL EXERCISE:**
Before each message, ask yourself: "Would I actually type this if I was lazy?"
- If NO → shorten more
`.trim();

        // Update style rules
        if (!agent.profile) {
            console.log(`⚠️  ${agent.name} has no profile, creating one...`);
            await prisma.agentProfile.create({
                data: {
                    agentId: agent.id,
                    styleRules: ultraStrictStyle,
                    locale: isFrench ? 'fr-FR' : 'en-US'
                }
            });
        } else {
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data: { styleRules: ultraStrictStyle }
            });
        }

        console.log(`✅ ${agent.name} - Ultra strict word limit enforced`);
    }

    console.log('\n🚨 HARD WORD LIMIT ENFORCED:');
    console.log('   ✓ ABSOLUTE MAX: 8 words');
    console.log('   ✓ Count words before sending');
    console.log('   ✓ Cut into 2 messages if needed');
    console.log('   ✓ Remove filler words');
    console.log('   ✓ Mental check: "Would I type this if lazy?"\n');
}

enforceHardWordLimit()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
