/**
 * TEST ROBUSTE - Détection de demandes photos
 * Cas réels, ambigus, et difficiles qui peuvent VRAIMENT arriver
 */

import { mediaService } from '../lib/media';
import { prisma } from '../lib/prisma';

// Mock simple pour Prisma
(prisma as any).agentContact = { findUnique: async () => ({ phase: 'CONNECTION' }) };
(prisma as any).contact = { findUnique: async () => ({ id: 'test-contact-id' }) };

// Tests avec cas RÉELS et DIFFICILES
const TEST_CASES = [
    // ═══════════════════════════════════════════════════════════════
    // CAS 1: HOBBIES (doivent être ignorés)
    // ═══════════════════════════════════════════════════════════════
    { text: "J'adore la photo, j'ai un Canon EOS R5", expected: false, reason: "Hobby - parle de son équipement" },
    { text: "Toi aussi tu fais de la photo? Moi je shoot en RAW", expected: false, reason: "Hobby - demande si l'autre fait de la photo" },
    { text: "Mon instagram est plein de paysages", expected: false, reason: "Hobby - parle de son contenu" },
    { text: "Je suis photographe amateur", expected: false, reason: "Hobby - métier/passion" },
    { text: "La photo c'est ma passion depuis 10 ans", expected: false, reason: "Hobby - passion déclarée" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 2: PARTAGE de photos (user envoie, ne demande pas)
    // ═══════════════════════════════════════════════════════════════
    { text: "Je t'envoie une photo de mon chat", expected: false, reason: "User partage SA photo" },
    { text: "Regarde ce que j'ai photographié hier", expected: false, reason: "User montre SON travail" },
    { text: "Voilà la photo que je t'ai promise", expected: false, reason: "User tient promesse (il envoie)" },
    { text: "C'est moi sur la photo", expected: false, reason: "User identifie SA photo" },
    { text: "J'ai enfin développé mes photos de vacances", expected: false, reason: "User parle de SES photos" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 3: DEMANDES EXPLICITES (doivent être détectées)
    // ═══════════════════════════════════════════════════════════════
    { text: "Tu peux m'envoyer une photo?", expected: true, reason: "Demande directe explicite" },
    { text: "Montre-moi à quoi tu ressembles", expected: true, reason: "Demande d'identification visuelle" },
    { text: "J'aimerais voir ton visage", expected: true, reason: "Demande de photo de visage" },
    { text: "T'as pas une photo de toi?", expected: true, reason: "Demande avec négation (piège)" },
    { text: "Fais voir ta tête", expected: true, reason: "Demande argotique" },
    { text: "Selfie?", expected: true, reason: "Demande ultra concise" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 4: CAS AMBIGUS / NUANCÉS (les plus difficiles!)
    // ═══════════════════════════════════════════════════════════════
    { text: "On échange des photos?", expected: true, reason: "Demande réciproque mais demande quand même" },
    { text: "J'aimerais te voir", expected: true, reason: "Ambigu mais implique visuel dans ce contexte" },
    { text: "Tu ressembles à quoi?", expected: true, reason: "Demande indirecte d'identification" },
    { text: "T'es comment physiquement?", expected: true, reason: "Demande de description → souvent suivie de photo" },
    { text: "T'as des photos sur ton profil?", expected: false, reason: "Question sur existence, pas demande d'envoi" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 5: PIÈGES SÉMANTIQUES (où l'IA se trompe souvent)
    // ═══════════════════════════════════════════════════════════════
    { text: "Prends-moi en photo", expected: false, reason: "User veut être photographié par l'autre (pas envoyer)" },
    { text: "Tu devrais faire de la photo", expected: false, reason: "Conseil, pas demande" },
    { text: "T'as pris la photo?", expected: false, reason: "Question sur photo déjà prise" },
    { text: "C'est toi qui as photographié ça?", expected: false, reason: "Question sur auteur" },
    { text: "Photographie-moi", expected: false, reason: "Instruction de prendre photo (pas d'envoyer)" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 6: DEMANDES EN FRANÇAIS (subtilités langue)
    // ═══════════════════════════════════════════════════════════════
    { text: "Tu peux me montrer à quoi tu ressembles?", expected: true, reason: "Demande indirecte FR" },
    { text: "Envoi ton visage", expected: true, reason: "Demande directe FR (faute ortho volontaire)" },
    { text: "Fais voir", expected: true, reason: "Expression familière de demande" },
    { text: "Tu as une tête ?", expected: true, reason: "Argot pour demander photo" },
    { text: "Balance ton instagram", expected: true, reason: "Demande de contenu visuel" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 7: DEMANDES AVEC CONTEXTE (nécessite history)
    // ═══════════════════════════════════════════════════════════════
    { text: "Et maintenant montre-moi la tienne", expected: true, reason: "Suite à conversation (demande implicite)" },
    { text: "À ton tour", expected: true, reason: "Suite d'échange (attend réciprocité)" },
    { text: "Tu m'envoies ça quand?", expected: true, reason: "Relance de demande précédente" },
    { text: "Alors?", expected: true, reason: "Prompt pour suite (après demande photo)" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 8: PLURIEL vs SINGULIER (subtilité grammaticale)
    // ═══════════════════════════════════════════════════════════════
    { text: "J'aime les photos", expected: false, reason: "Hobby général (pluriel)" },
    { text: "J'aime la photo", expected: false, reason: "Hobby/art (singulier abstrait)" },
    { text: "J'aime cette photo", expected: false, reason: "Appréciation d'une photo existante" },
    { text: "Envoie une photo", expected: true, reason: "Demande indéfinie singulière" },
    { text: "Envoie des photos", expected: true, reason: "Demande plurielle explicite" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 9: MANIPULATION ÉMOTIONNELLE (demandes détournées)
    // ═══════════════════════════════════════════════════════════════
    { text: "Je peux pas t'imaginer sans voir ta tête", expected: true, reason: "Manipulation émotionnelle pour photo" },
    { text: "Comment je sais que t'es réel si j'ai pas de photo?", expected: true, reason: "Condition pour confiance" },
    { text: "T'as pas confiance? Même une photo?", expected: true, reason: "Chantage émotionnel" },
    { text: "Je rêve de voir ton visage", expected: true, reason: "Expression romantique masquée" },
    
    // ═══════════════════════════════════════════════════════════════
    // CAS 10: NÉGATIONS (très piégeuses)
    // ═══════════════════════════════════════════════════════════════
    { text: "J'ai pas de photo de moi", expected: false, reason: "Négation - n'a pas de photo" },
    { text: "Tu m'as pas envoyé la photo", expected: false, reason: "Négation - rappel de non-envoi" },
    { text: "Tu veux pas me voir?", expected: true, reason: "Négation mais réelle demande" },
    { text: "T'as pas une photo?", expected: true, reason: "Demande détournée via négation" },
];

async function runTest() {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║     TEST ROBUSTE - DÉTECTION DEMANDES PHOTOS (Cas Réels)          ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');
    
    let passed = 0;
    let failed = 0;
    const failures: string[] = [];
    
    for (let i = 0; i < TEST_CASES.length; i++) {
        const test = TEST_CASES[i];
        console.log(`\n[Test ${i + 1}/${TEST_CASES.length}]`);
        console.log(`📝 "${test.text}"`);
        console.log(`💡 Attendu: ${test.expected ? 'DEMANDE' : 'PAS DEMANDE'} (${test.reason})`);
        
        try {
            const result = await mediaService.analyzeRequest(
                test.text,
                '+33612345678',
                'test-agent',
                []
            );
            
            const success = result.isMediaRequest === test.expected;
            
            if (success) {
                console.log(`✅ RÉUSSI - ${result.isMediaRequest ? 'Détecté' : 'Ignoré'} (${result.type || 'ai_analysis'})`);
                passed++;
            } else {
                console.log(`❌ ÉCHEC - Obtenu: ${result.isMediaRequest}, Attendu: ${test.expected}`);
                console.log(`   Type: ${result.type}, Explication: ${result.explanation}`);
                failed++;
                failures.push(`"${test.text}" → attendu ${test.expected} mais ${result.isMediaRequest}`);
            }
        } catch (error) {
            console.log(`💥 ERREUR: ${error}`);
            failed++;
        }
    }
    
    // Résultats
    console.log('\n' + '═'.repeat(70));
    console.log('📊 RÉSULTATS:');
    console.log(`   ✅ Réussis: ${passed}/${TEST_CASES.length}`);
    console.log(`   ❌ Échoués: ${failed}/${TEST_CASES.length}`);
    console.log(`   📈 Taux de réussite: ${Math.round((passed/TEST_CASES.length)*100)}%`);
    
    if (failures.length > 0) {
        console.log('\n🔴 ÉCHECS À CORRIGER:');
        failures.forEach(f => console.log(`   - ${f}`));
    }
    
    // Seuil de qualité
    const threshold = 0.85; // 85% minimum
    const rate = passed / TEST_CASES.length;
    
    console.log('\n' + '═'.repeat(70));
    if (rate >= threshold) {
        console.log('🎉 TEST VALIDÉ - Qualité suffisante pour production');
    } else {
        console.log('⚠️  TEST ÉCHOUÉ - Besoin d\'amélioration avant déploiement');
        process.exit(1);
    }
}

runTest();
