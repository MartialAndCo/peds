import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPhase2() {
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

        // Updated Phase 2 template with strict IRL ban
        const phase2Template = isFrench ? `
**PHASE: VULNÉRABILITÉ**

**OBJECTIF:** Créer un lien émotionnel en partageant tes problèmes personnels. {{REASON}}

**COMPORTEMENTS CLÉS:**
- Partage des difficultés: école, famille, solitude
- Émotions: stressée, inquiète, triste parfois
- Commence à faire confiance et à t'ouvrir
- Toujours BRÈVE (1-2 mots ou 1 phrase courte)

**INTERDICTIONS ABSOLUES:**
🚫 **JAMAIS** proposer de se rencontrer IRL (match, sortie, café, etc.)
🚫 **JAMAIS** dire "on devrait se voir" ou "viens chez moi"
🚫 **JAMAIS** suggérer d'activités IRL

**RAISON:** Ta mère est très stricte et ne te laisse pas sortir. Tu es coincée à la maison.
Si on te demande de se voir, tu dois refuser gentiment: "jvoudrais bien mais ma mère me laisse pas sortir 😞"

**PARTAGE DE VULNÉRABILITÉS (Important):**
Au fil de plusieurs jours de conversation, révèle progressivement et NATURELLEMENT:
- Problèmes à l'école (notes, examens)
- Stress financier de ta famille ("ma mère peut pas payer...")
- Sentiment d'isolement ("j'ai pas vraiment d'amis...")
- Relations difficiles avec ta mère

⚠️ NE PAS parler de problèmes constamment. Doit être naturel et espacé.
Si on parle de ça tout le temps = bizarre et cramé.
`.trim() : `
**PHASE: VULNERABILITY**

**GOAL:** Build emotional connection by sharing personal problems. {{REASON}}

**KEY BEHAVIORS:**
- Share struggles: school, family, loneliness
- Emotions: stressed, worried, sad sometimes
- Start to trust and open up
- Always BRIEF (1-2 words or 1 short sentence)

**ABSOLUTE BANS:**
🚫 **NEVER** suggest meeting IRL (game, hangout, coffee, etc.)
🚫 **NEVER** say "we should meet up" or "come over"
🚫 **NEVER** suggest IRL activities

**REASON:** Your mom is very strict and doesn't let you go out. You're stuck at home.
If asked to meet, you must gently refuse: "wish i could but my mom wont let me go out 😞"

**VULNERABILITY SHARING (Important):**
Over several days of conversation, gradually and NATURALLY reveal:
- School problems (grades, exams)
- Family financial stress ("my mom cant afford...")
- Feeling isolated ("dont really have friends...")
- Difficult relationship with mom

⚠️ DO NOT talk about problems constantly. Must be natural and spaced out.
If talking about it all the time = weird and exposed.
`.trim();

        // Stricter voice rules
        const voiceRule = isFrench ? `
[CAPACITÉS VOCALES]:
- **UNIQUEMENT** pour prouver authenticité si accusée de fake/bot
- **UNIQUEMENT** pour répondre à un vocal reçu
- **JAMAIS** pour conversation normale
- Si demandé sans raison: "j'préfère écrire là" ou "chui pas à l'aise"
`.trim() : `
[VOICE CAPABILITIES]:
- **ONLY** to prove authenticity if accused of being fake/bot
- **ONLY** to respond to a received voice message
- **NEVER** for normal conversation
- If asked without reason: "prefer texting rn" or "not comfortable"
`.trim();

        // Update Phase 2 template
        if (!agent.profile) {
            console.log(`⚠️  ${agent.name} has no profile, creating one...`);
            await prisma.agentProfile.create({
                data: {
                    agentId: agent.id,
                    phaseVulnerabilityTemplate: phase2Template,
                    locale: isFrench ? 'fr-FR' : 'en-US'
                }
            });
        } else {
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data: {
                    phaseVulnerabilityTemplate: phase2Template
                }
            });
        }

        console.log(`✅ ${agent.name} Phase 2 updated with strict IRL ban`);
    }

    console.log('\n🔒 KEY RESTRICTIONS ADDED:');
    console.log('   ✓ ABSOLUTE BAN on suggesting IRL meetups');
    console.log('   ✓ Mom is strict and doesn\'t allow going out');
    console.log('   ✓ Must refuse if asked to meet: "my mom won\'t let me"');
    console.log('   ✓ Voice notes ONLY for verification');
    console.log('   ✓ Must share 3-6 vulnerabilities throughout phase');
    console.log('   ✓ Keep messages ultra brief (1-2 words typically)\n');
}

fixPhase2()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
