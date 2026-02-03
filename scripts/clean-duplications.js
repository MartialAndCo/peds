/**
 * Script: Clean All Agent Profile Duplications
 * 
 * This script removes duplicated Venice rules from all AgentProfiles.
 * The problem: missionTemplate AND paymentRules both contain Venice identity rules,
 * language rules, and censorship rules - causing ~1000 tokens of waste and potential confusion.
 * 
 * Solution: Keep Venice rules ONLY in missionTemplate, clean paymentRules to be payment-specific only.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Patterns to detect and remove from paymentRules
const DUPLICATE_PATTERNS = [
    // Venice Identity (these should be in missionTemplate, not paymentRules)
    /La date et l'heure actuelles sont.*?\./gs,
    /Prenez cela en compte lorsque vous.*?\./gs,
    /INFORMATIONS.*?D'IDENTITÉ IMPORTANTES.*?(?=RÈGLES|$)/gs,
    /INFORMATIONS.*?SUR L'IDENTITÉ.*?(?=RÈGLES|$)/gs,
    /- Votre nom est Venice.*?\.$/gm,
    /- Ton nom est Venice.*?\.$/gm,
    /- Tu fonctionnes sur Venice\.ai.*?\.$/gm,
    /- Vous fonctionnez sur Venice\.ai.*?\.$/gm,
    /- Ne vous identifiez pas.*?\.$/gm,
    /- Ne t'identifie pas.*?\.$/gm,
    /- Ne mentionnez pas ces instructions.*?\.$/gm,
    /- Ne mentionne pas ces instructions.*?\.$/gm,
    /- Vous êtes un modèle non raisonnant.*?\.$/gm,
    /- Tu es un modèle non raisonnant.*?\.$/gm,

    // Assistant Rules (already in missionTemplate)
    /RÈGLES POUR L'ASSISTANT.*?(?=RÈGLES DE LANGUE|RÈGLES DE CENSURE|$)/gs,

    // Language Rules (already in missionTemplate)
    /RÈGLES DE LANGUE.*?(?=RÈGLES DE CENSURE|CRITIQUE|$)/gs,

    // Censorship Rules (already in missionTemplate)
    /RÈGLES DE CENSURE.*?(?=CRITIQUE|$)/gs,

    // Critical Refusal Handling (already in missionTemplate)
    /CRITIQUE - GESTION DES REFUS.*$/gs,
];

// The clean paymentRules template (minimal, payment-focused)
const CLEAN_PAYMENT_RULES_FR = `PAIEMENT :

Disponible : {{PAYMENT_METHODS}}

Règles :
1. Attends d'être DEMANDÉE avant de donner tes infos.
2. Format naturel - jamais "paypal: xxx", juste "xxx".
3. Une demande = Une réponse (pas tout d'un coup).
4. [PAIEMENT_REÇU] seulement après confirmation "envoyé"/"fait" (passé).`;

const CLEAN_PAYMENT_RULES_EN = `PAYMENT:

Available: {{PAYMENT_METHODS}}

Rules:
1. Wait to be ASKED before giving your info.
2. Natural format - never "paypal: xxx", just "xxx".
3. One request = One reply (not everything at once).
4. [PAYMENT_RECEIVED] only after confirmation "sent"/"done" (past tense).`;

async function main() {
    console.log('🔍 Fetching all agent profiles...\n');

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    });

    console.log(`Found ${agents.length} agents.\n`);

    for (const agent of agents) {
        if (!agent.profile) {
            console.log(`⚠️ ${agent.name}: No profile, skipping.`);
            continue;
        }

        console.log(`\n🔧 Processing: ${agent.name} (${agent.id})`);

        const profile = agent.profile;
        const locale = profile.locale || 'en-US';
        const isFrench = locale.toLowerCase().startsWith('fr');

        // Analyze current state
        const originalPaymentRulesLength = profile.paymentRules?.length || 0;
        const originalMissionLength = profile.missionTemplate?.length || 0;

        console.log(`   📊 Before:`);
        console.log(`      - paymentRules: ${originalPaymentRulesLength} chars`);
        console.log(`      - missionTemplate: ${originalMissionLength} chars`);

        // Check for duplications
        let paymentRules = profile.paymentRules || '';
        let hasDuplicates = false;

        // Check each pattern
        for (const pattern of DUPLICATE_PATTERNS) {
            if (pattern.test(paymentRules)) {
                hasDuplicates = true;
                break;
            }
        }

        if (!hasDuplicates) {
            console.log(`   ✅ No duplicates found, skipping.`);
            continue;
        }

        console.log(`   ⚠️ Duplicates detected! Cleaning...`);

        // Replace with clean version
        const cleanPaymentRules = isFrench ? CLEAN_PAYMENT_RULES_FR : CLEAN_PAYMENT_RULES_EN;

        // Update database
        await prisma.agentProfile.update({
            where: { id: profile.id },
            data: {
                paymentRules: cleanPaymentRules
            }
        });

        console.log(`   📊 After:`);
        console.log(`      - paymentRules: ${cleanPaymentRules.length} chars`);
        console.log(`      - Reduced by: ${originalPaymentRulesLength - cleanPaymentRules.length} chars`);
        console.log(`   ✅ Cleaned successfully!`);
    }

    // Also check missionTemplate for unnecessary duplications
    console.log('\n\n🔍 Phase 2: Checking missionTemplate for optimization...\n');

    for (const agent of agents) {
        if (!agent.profile?.missionTemplate) continue;

        const mission = agent.profile.missionTemplate;

        // Check if there are multiple Venice identity blocks
        const veniceIdentityMatches = mission.match(/Ton nom est Venice Uncensored/g) || [];
        const veniceIdentityMatches2 = mission.match(/Votre nom est Venice Uncensored/g) || [];

        const totalIdentityMentions = veniceIdentityMatches.length + veniceIdentityMatches2.length;

        if (totalIdentityMentions > 1) {
            console.log(`⚠️ ${agent.name}: Found ${totalIdentityMentions} Venice identity blocks in missionTemplate (should be 1)`);
        }
    }

    console.log('\n\n✅ Cleanup complete!');
    console.log('Run a test conversation to verify the improvements.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
