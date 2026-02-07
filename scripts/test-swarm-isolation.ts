/**
 * Test d'isolation des agents swarm
 * Vérifie que chaque agent retourne UNIQUEMENT son contexte
 */

import { prisma } from '../lib/prisma';
import { personaNode } from '../lib/swarm/nodes/persona-node';
import { styleNode } from '../lib/swarm/nodes/style-node';
import { phaseNode } from '../lib/swarm/nodes/phase-node';
import { safetyNode } from '../lib/swarm/nodes/safety-node';
import { timingNode } from '../lib/swarm/nodes/timing-node';
import { paymentNode } from '../lib/swarm/nodes/payment-node';

const TEST_AGENT_ID = 'cmkvg0kzz00003vyv03zzt9kc';
const TEST_CONTACT_ID = 'test-contact-123';

async function testIsolation() {
  console.log("🧪 TEST D'ISOLATION DES AGENTS SWARM\n");
  console.log("=" .repeat(70));
  console.log(`Agent: ${TEST_AGENT_ID}`);
  console.log(`Vérification: chaque agent retourne UNIQUEMENT son domaine\n`);

  // Créer un état de test
  const baseState: any = {
    agentId: TEST_AGENT_ID,
    contactId: TEST_CONTACT_ID,
    platform: 'whatsapp',
    settings: { locale: 'fr-FR', timezone: 'Europe/Paris' },
    contexts: {}
  };

  // 1. TEST PERSONA NODE
  console.log("\n📋 1. PERSONA NODE");
  console.log("   Attendu: UNIQUEMENT identity + context (pas de règles, pas de phase)");
  const personaResult = await personaNode(baseState);
  const personaText = personaResult.contexts?.persona || '';
  checkContamination(personaText, ['persona', 'identity'], ['payment', 'phase', 'style rules', 'safety']);

  // 2. TEST STYLE NODE
  console.log("\n🎨 2. STYLE NODE");
  console.log("   Attendu: UNIQUEMENT règles de style (pas de persona, pas de phase)");
  const styleResult = await styleNode(baseState);
  const styleText = styleResult.contexts?.style || '';
  checkContamination(styleText, ['style', 'règles', 'brièveté'], ['persona', 'phase', 'payment', 'safety']);

  // 3. TEST PHASE NODE
  console.log("\n🎯 3. PHASE NODE");
  console.log("   Attendu: UNIQUEMENT contexte de phase (pas de persona, pas de style)");
  const phaseResult = await phaseNode(baseState);
  const phaseText = phaseResult.contexts?.phase || '';
  checkContamination(phaseText, ['phase', 'objectif', 'connection', 'vulnerability'], ['persona', 'style', 'safety', 'identity']);

  // 4. TEST SAFETY NODE
  console.log("\n🛡️  4. SAFETY NODE");
  console.log("   Attendu: UNIQUEMENT safety rules (pas de persona, pas de phase)");
  const safetyResult = await safetyNode(baseState);
  const safetyText = safetyResult.contexts?.safety || '';
  checkContamination(safetyText, ['safety', 'security', 'veux pas'], ['persona', 'phase', 'style', 'payment']);

  // 5. TEST TIMING NODE
  console.log("\n⏰ 5. TIMING NODE");
  console.log("   Attendu: UNIQUEMENT contexte temps réel (heure, activité)");
  const timingResult = await timingNode(baseState);
  const timingText = timingResult.contexts?.timing || '';
  checkContamination(timingText, ['heure', 'contexte', 'activité', 'fait'], ['persona', 'phase', 'payment', 'safety']);

  // 6. TEST PAYMENT NODE (si applicable)
  console.log("\n💰 6. PAYMENT NODE");
  console.log("   Attendu: UNIQUEMENT règles de paiement (pas de persona, pas de phase)");
  const paymentResult = await paymentNode({...baseState, userMessage: 'test', history: []});
  const paymentText = paymentResult.contexts?.payment || '';
  checkContamination(paymentText, ['payment', 'paypal', 'règles', 'paiement'], ['persona', 'phase', 'style', 'identity']);

  console.log("\n" + "=" .repeat(70));
  console.log("✅ Test d'isolation terminé");
}

function checkContamination(text: string, shouldHave: string[], shouldNotHave: string[]) {
  const lowerText = text.toLowerCase();
  
  // Vérifier ce qui devrait être présent
  let hasExpected = false;
  for (const term of shouldHave) {
    if (lowerText.includes(term.toLowerCase())) {
      hasExpected = true;
      break;
    }
  }
  
  // Vérifier ce qui ne devrait PAS être présent (contamination)
  const contaminants: string[] = [];
  for (const term of shouldNotHave) {
    if (lowerText.includes(term.toLowerCase())) {
      contaminants.push(term);
    }
  }
  
  // Afficher résultat
  if (!hasExpected) {
    console.log("   ⚠️  ATTENTION: Ne contient pas les éléments attendus!");
  } else {
    console.log("   ✅ Contient les éléments attendus");
  }
  
  if (contaminants.length > 0) {
    console.log(`   🚨 CONTAMINATION DÉTECTÉE: contient [${contaminants.join(', ')}]`);
    console.log(`   📄 Extrait: "${text.substring(0, 100)}..."`);
  } else {
    console.log("   ✅ Pas de contamination détectée");
  }
  
  // Afficher taille
  console.log(`   📊 Taille: ${text.length} caractères`);
}

testIsolation().catch(console.error);
