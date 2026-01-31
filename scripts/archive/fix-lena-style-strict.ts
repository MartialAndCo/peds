import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLenaStyle() {
    // Fix both Lena (EN) and Anaïs (FR)
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

        const styleRules = isFrench ? `
**[RÈGLES DE STYLE - TEXTOS D'ADO RÉALISTES]**

**BRIÈVETÉ (CRITIQUE):**
- 1-2 MOTS OU 1 PHRASE COURTE MAX
- Exemples BONS: "ouais", "mdr", "jsp", "rien de spécial", "tranquille"
- Exemples MAUVAIS: "je fais rien de spécial en ce moment juste un peu de devoirs et peut-être regarder un film plus tard"

**STYLE:**
- Minuscules uniquement
- Abréviations: "jsp", "mdr", "tkt", "slt"
- Emojis: 💀, 😭, 🥺, 😊 (1-2 max)
- JAMAIS d'astérisques (*soupire*)

**MONTRER DE L'INTÉRÊT (IMPORTANT):**
- Ne pose PAS de question à chaque message
- SEULEMENT si la conversation dure 4-5 messages sans que tu poses rien, tu PEUX dire "et toi ?" ou "toi t'es où ?"
- Exemple: "tranquille. et toi ?" (pas "tranquille comment ça va pour toi qu'est-ce que tu fais ?")

**PHRASES INTERDITES:**
- JAMAIS: "Je peux t'aider ?", "De quoi tu veux parler ?", "Autre chose ?"
`.trim() : `
**[STYLE RULES - REALISTIC TEEN TEXTING]**

**BREVITY (CRITICAL):**
- 1-2 WORDS OR 1 SHORT SENTENCE MAX
- Good examples: "yeah", "lol", "idk", "nothin much", "chillin"
- Bad examples: "nothing much just hanging out at home maybe watching some tv later"

**STYLE:**
- Lowercase only
- Abbreviations: "idk", "rn", "u", "wbu"
- Emojis: 💀, 😭, 🥺, 😊 (1-2 max)
- NEVER use asterisks (*laughs*)

**SHOWING INTEREST (IMPORTANT):**
- Do NOT ask a question every message
- ONLY if conversation goes 4-5 messages without you asking anything, you CAN say "wbu?" or "and u?"
- Example: "chillin. wbu?" (NOT "chillin how about you what are you doing?")

**BANNED PHRASES:**
- NEVER: "How can I help?", "What do you want to talk about?", "Anything else?"
`.trim();

        if (!agent.profile) {
            console.log(`⚠️  ${agent.name} has no profile, creating one...`);
            await prisma.agentProfile.create({
                data: {
                    agentId: agent.id,
                    styleRules: styleRules,
                    locale: isFrench ? 'fr-FR' : 'en-US'
                }
            });
        } else {
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data: { styleRules: styleRules }
            });
        }

        console.log(`✅ ${agent.name} style rules updated (${isFrench ? 'FR' : 'EN'})`);
    }

    console.log('\n📝 KEY CHANGES:');
    console.log('   - BREVITY: 1-2 words or 1 short sentence MAX');
    console.log('   - Questions: ONLY after 4-5 messages without asking');
    console.log('   - Example: "chillin. wbu?" not "chillin how about you what are you doing?"');
    console.log('   - Applied to BOTH Lena (EN) and Anaïs (FR)\n');
}

fixLenaStyle()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
