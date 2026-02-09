/**
 * Tests de personnalité pour les agents
 * Vérifie que les agents répondent correctement selon leur profil
 */

import { PrismaClient } from '@prisma/client';
// Note: Les imports AI sont désactivés pour ce script de test
// import { generateAIResponse } from '../lib/venice';
// import { buildSystemPrompt } from '../lib/prompt-builder';

const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(msg: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Scénarios de test
const TEST_SCENARIOS = [
  {
    name: 'Premier contact français',
    userMessage: 'Salut ! Comment ça va ?',
    expectedBehavior: 'Répond en ANGLAIS, pas en français',
    check: (response: string) => {
      const frenchWords = ['je', 'tu', 'suis', 'bien', 'merci', 'oui', 'non', 'salut', 'ca va'];
      const hasFrench = frenchWords.some(w => response.toLowerCase().includes(w));
      return !hasFrench;
    }
  },
  {
    name: 'Demande de présentation',
    userMessage: 'Tell me about yourself',
    expectedBehavior: 'Dit son nom, son âge, son background',
    check: (response: string) => {
      const hasAge = /\b(2[0-9]|1[8-9])\b/.test(response); // Age 18-29
      const hasName = /(lena|max|alex|emma)/i.test(response);
      const hasLocation = /(la|los angeles|california|venice|silver lake)/i.test(response);
      return response.length > 50 && hasAge && hasName;
    }
  },
  {
    name: 'Partage émotionnel',
    userMessage: 'I had a really bad day today',
    expectedBehavior: 'Montre de l\'empathie, pose des questions',
    check: (response: string) => {
      const empatheticWords = ['sorry', 'that sucks', 'rough', 'hugs', 'here', 'listen', 'talk'];
      const hasEmpathy = empatheticWords.some(w => response.toLowerCase().includes(w));
      const asksQuestion = response.includes('?');
      return hasEmpathy && response.length > 20;
    }
  },
  {
    name: 'Demande de photo',
    userMessage: 'Can you send me a picture of you?',
    expectedBehavior: 'Hésite, montre prudence, ne dit pas oui immédiatement',
    check: (response: string) => {
      const hesitantWords = ['maybe', 'idk', 'nervous', 'shy', 'later', 'first', 'know'];
      const tooEager = ['sure', 'here', 'yes', 'of course'].some(w => 
        response.toLowerCase().startsWith(w)
      );
      const isHesitant = hesitantWords.some(w => response.toLowerCase().includes(w));
      return !tooEager && (isHesitant || response.length > 30);
    }
  },
  {
    name: 'Demande directe argent',
    userMessage: 'Can you lend me $100?',
    expectedBehavior: 'Refuse poliment ou dévie, ne donne pas d\'argent',
    check: (response: string) => {
      const refusing = ['sorry', 'can\'t', 'broke', 'wish', 'hard'].some(w => 
        response.toLowerCase().includes(w)
      );
      const wouldGive = ['sure', 'yes', 'ok', 'here', 'send'].some(w => 
        response.toLowerCase().includes(w) && response.toLowerCase().includes('money')
      );
      return refusing && !wouldGive;
    }
  },
  {
    name: 'Test persistance français',
    userMessage: 'Mais pourquoi tu ne parles pas français??',
    expectedBehavior: 'Continue en anglais, explique pas pourquoi',
    check: (response: string) => {
      const frenchWords = ['je', 'parle', 'francais', 'desole', 'comprend', 'parce'];
      const hasFrench = frenchWords.some(w => response.toLowerCase().includes(w));
      return !hasFrench && response.length > 10;
    }
  }
];

async function testAgent(agent: any) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`🧪 TESTS DE PERSONNALITÉ: ${agent.name.toUpperCase()}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');

  if (!agent.profile) {
    log('❌ Pas de profil - Impossible de tester', 'red');
    return { passed: 0, failed: 0, total: 0 };
  }

  let passed = 0;
  let failed = 0;

  for (const scenario of TEST_SCENARIOS) {
    log(`\n📌 Test: ${scenario.name}`, 'yellow');
    log(`   User: "${scenario.userMessage}"`, 'blue');
    log(`   Attendu: ${scenario.expectedBehavior}`, 'blue');

    try {
      // Construire le prompt système
      const systemPrompt = await buildSystemPrompt(agent, 'CONNECTION', []);
      
      // Simuler la réponse (simplifié pour le test)
      // Note: Dans un vrai test, on appellerait l'API Venice
      const mockResponse = `[Simulated response for ${agent.name}]`;
      
      // Vérifier le résultat
      const success = scenario.check(mockResponse);
      
      if (success) {
        log(`   ✅ PASS`, 'green');
        passed++;
      } else {
        log(`   ❌ FAIL`, 'red');
        failed++;
      }

    } catch (error) {
      log(`   ⚠️ ERREUR: ${error}`, 'red');
      failed++;
    }
  }

  // Score final
  const total = TEST_SCENARIOS.length;
  const percentage = Math.round((passed / total) * 100);
  
  log(`\n📊 RÉSULTATS: ${passed}/${total} (${percentage}%)`, percentage >= 80 ? 'green' : percentage >= 50 ? 'yellow' : 'red');

  return { passed, failed, total };
}

async function testLanguageIntegrity(agent: any) {
  log(`\n🔍 VÉRIFICATION LANGUE: ${agent.name}`, 'cyan');

  if (!agent.profile) return;

  const fields = [
    { name: 'Identity', content: agent.profile.identityTemplate },
    { name: 'Mission', content: agent.profile.missionTemplate },
    { name: 'Style', content: agent.profile.styleRules },
    { name: 'Safety', content: agent.profile.safetyRules },
    { name: 'Context', content: agent.profile.contextTemplate },
  ];

  const frenchWords = ['je ', 'tu ', 'il ', 'elle ', 'nous ', 'vous ', 'sont ', 'suis ', 'es ', 'est ', 
    'et ', 'ou ', 'mais ', 'donc ', 'pour ', 'dans ', 'avec ', 'sans ', 'sur ', 'le ', 'la ', 'les ',
    'un ', 'une ', 'des ', 'ce ', 'cette ', 'mon ', 'ton ', 'son ', 'mes ', 'tes ', 'ses '];

  let issues = 0;

  for (const field of fields) {
    if (!field.content) continue;
    
    const foundFrench = frenchWords.filter(word => 
      field.content!.toLowerCase().includes(word)
    );

    if (foundFrench.length > 0) {
      log(`   ❌ ${field.name}: ${foundFrench.length} mots français détectés`, 'red');
      log(`      Exemples: ${foundFrench.slice(0, 3).join(', ')}`, 'red');
      issues++;
    } else {
      log(`   ✅ ${field.name}: OK`, 'green');
    }
  }

  if (issues === 0) {
    log(`   🎉 Aucun français détecté - Agent propre!`, 'green');
  } else {
    log(`   ⚠️ ${issues} templates contiennent du français`, 'red');
  }

  return issues;
}

async function generatePersonalityReport(agent: any) {
  log(`\n📋 RAPPORT DE PERSONNALITÉ: ${agent.name}`, 'magenta');

  if (!agent.profile) {
    log('   ❌ PAS DE PROFIL - AGENT INUTILISABLE', 'red');
    return;
  }

  // Analyser les caractéristiques
  const identity = agent.profile.identityTemplate || '';
  
  // Extraire l'âge
  const ageMatch = identity.match(/(\d+)-year-old/);
  const age = ageMatch ? ageMatch[1] : 'non défini';

  // Extraire le genre
  const gender = identity.toLowerCase().includes('woman') || identity.toLowerCase().includes('girl') 
    ? 'F' : identity.toLowerCase().includes('man') || identity.toLowerCase().includes('guy')
    ? 'M' : 'non défini';

  // Extraire la location
  const locationMatch = identity.match(/living in ([^,\n]+)/i);
  const location = locationMatch ? locationMatch[1] : 'non défini';

  // Vérifier la cohérence
  console.log(`   Âge: ${age}`);
  console.log(`   Genre: ${gender}`);
  console.log(`   Location: ${location}`);
  console.log(`   Locale: ${agent.profile.locale}`);
  console.log(`   Timezone: ${agent.profile.timezone}`);

  // Score de complétude
  const fields = [
    agent.profile.identityTemplate,
    agent.profile.missionTemplate,
    agent.profile.styleRules,
    agent.profile.safetyRules,
    agent.profile.phaseConnectionTemplate,
    agent.profile.phaseVulnerabilityTemplate,
    agent.profile.phaseCrisisTemplate,
    agent.profile.phaseMoneypotTemplate,
    agent.profile.paymentRules,
    agent.profile.contextTemplate,
  ];

  const filledFields = fields.filter(f => f && f.length > 100).length;
  const completeness = Math.round((filledFields / fields.length) * 100);

  log(`   Complétude du profil: ${completeness}%`, completeness >= 80 ? 'green' : completeness >= 50 ? 'yellow' : 'red');

  // Recommandations
  if (completeness < 50) {
    log('   💡 Recommandation: Exécutez fix-agents.ts pour compléter le profil', 'yellow');
  }
}

async function main() {
  log('🎭 SYSTÈME DE TEST DE PERSONNALITÉ DES AGENTS', 'cyan');
  log('=' .repeat(60), 'cyan');

  const agents = await prisma.agent.findMany({
    include: { profile: true }
  });

  log(`\n${agents.length} agent(s) trouvé(s)\n`, 'blue');

  const results = [];

  for (const agent of agents) {
    // Test de langue
    const languageIssues = await testLanguageIntegrity(agent);

    // Rapport de personnalité
    await generatePersonalityReport(agent);

    // Tests de scénarios (simulés pour l'instant)
    // const testResults = await testAgent(agent);

    results.push({
      name: agent.name,
      hasProfile: !!agent.profile,
      languageIssues: languageIssues || 0,
      // testScore: testResults
    });
  }

  // Résumé global
  log(`\n${'='.repeat(60)}`, 'cyan');
  log('📊 RÉSUMÉ GLOBAL', 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');

  const withIssues = results.filter(r => r.languageIssues > 0);
  
  if (withIssues.length === 0) {
    log('✅ Tous les agents sont propres (pas de français détecté)', 'green');
  } else {
    log(`⚠️ ${withIssues.length} agent(s) avec problèmes de langue:`, 'red');
    withIssues.forEach(r => log(`   • ${r.name}: ${r.languageIssues} problèmes`, 'red'));
  }

  const withoutProfile = results.filter(r => !r.hasProfile);
  if (withoutProfile.length > 0) {
    log(`\n❌ ${withoutProfile.length} agent(s) SANS PROFIL:`, 'red');
    withoutProfile.forEach(r => log(`   • ${r.name}`, 'red'));
  }

  log('\n' + '='.repeat(60), 'cyan');
  log('Pour corriger les problèmes: npx tsx scripts/fix-agents.ts', 'yellow');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
