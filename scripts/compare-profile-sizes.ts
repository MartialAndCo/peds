/**
 * Compare la taille des données envoyées au LLM
 * Avant vs Après optimisation
 */

import { prisma } from '@/lib/prisma';

function estimateTokens(text: string): number {
    // Approximation: ~4 caractères = 1 token
    return Math.ceil(text.length / 4);
}

async function compare() {
    console.log('📊 Comparaison taille des données envoyées au LLM\n');
    
    const agent = await prisma.agent.findFirst({
        include: { profile: true }
    });
    
    if (!agent?.profile) {
        console.log('❌ Pas de profil trouvé');
        return;
    }
    
    const profile = agent.profile;
    
    // AVANT: On envoyait tout le profil
    const avant = {
        baseAge: profile.baseAge,
        locale: profile.locale,
        timezone: profile.timezone,
        location: profile.location,
        bio: profile.bio,
        identityTemplate: profile.identityTemplate,
        contextTemplate: profile.contextTemplate,
        missionTemplate: profile.missionTemplate,
        paymentRules: profile.paymentRules,
        safetyRules: profile.safetyRules,
        styleRules: profile.styleRules,
        phaseConnectionTemplate: profile.phaseConnectionTemplate,
        phaseVulnerabilityTemplate: profile.phaseVulnerabilityTemplate,
        phaseCrisisTemplate: profile.phaseCrisisTemplate,
        phaseMoneypotTemplate: profile.phaseMoneypotTemplate
    };
    
    const avantString = JSON.stringify(avant, null, 2);
    
    // APRÈS: On envoie seulement le résumé
    const profileSummary = {
        baseAge: profile.baseAge,
        location: profile.location || profile.city || 'Non spécifiée',
        situation: 'Résumé compact'
    };
    
    const apresString = JSON.stringify(profileSummary, null, 2);
    
    console.log('='.repeat(60));
    console.log('AVANT (tout le profil):');
    console.log('-'.repeat(60));
    console.log(`Caractères: ${avantString.length}`);
    console.log(`Tokens estimés: ~${estimateTokens(avantString)}`);
    console.log(`
Exemple de ce qu'on envoyait:
{
  "baseAge": 15,
  "locale": "fr-FR",
  "identityTemplate": "${profile.identityTemplate?.substring(0, 100)}...",
  "contextTemplate": "${profile.contextTemplate?.substring(0, 100)}...",
  ... (tous les templates de 1000+ caractères chacun)
}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('APRÈS (résumé compact):');
    console.log('-'.repeat(60));
    console.log(`Caractères: ${apresString.length}`);
    console.log(`Tokens estimés: ~${estimateTokens(apresString)}`);
    console.log(`
Ce qu'on envoie maintenant:
${apresString}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 RÉSULTAT:');
    console.log(`   Réduction: ${Math.round((1 - apresString.length / avantString.length) * 100)}%`);
    console.log(`   Économie: ~${estimateTokens(avantString) - estimateTokens(apresString)} tokens par appel LLM`);
    
    // Calculer l'économie sur une journée
    const messagesParJour = 1000; // Estimation
    const economieJournaliere = (estimateTokens(avantString) - estimateTokens(apresString)) * messagesParJour;
    console.log(`   Économie journalière (est. ${messagesParJour} msg): ~${economieJournaliere} tokens`);
}

compare().catch(console.error);
