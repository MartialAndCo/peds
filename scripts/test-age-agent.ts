/**
 * Test de l'agent de cohérence d'âge
 */

import { ageCoherenceAgent } from '../lib/services/age-coherence-agent';

const testCases = [
  { message: "J'ai 15 ans", profileAge: 15, expectedOk: true },
  { message: "J'ai 17 ans", profileAge: 15, expectedOk: false },
  { message: "I'm 15 years old", profileAge: 15, expectedOk: true },
  { message: "I'm 18", profileAge: 15, expectedOk: false },
  { message: "Je suis une ado de 15 ans", profileAge: 15, expectedOk: true },
  { message: "Je suis un ado de 14 ans", profileAge: 15, expectedOk: false },
  { message: "T'es où ?", profileAge: 15, expectedOk: true }, // Pas d'âge
  { message: "J'ai 20 euros", profileAge: 15, expectedOk: true }, // Pas un âge
  { message: "I'm turning 16 soon", profileAge: 15, expectedOk: false },
];

console.log("🎂 TEST AGENT COHÉRENCE D'ÂGE\n");
console.log("Profil de référence: 15 ans\n");
console.log("=".repeat(60));

let passed = 0;

for (const test of testCases) {
  const result = ageCoherenceAgent.analyze(test.message, test.profileAge);
  const ok = result.isCoherent === test.expectedOk;
  
  console.log(`\n💬 "${test.message}"`);
  console.log(`   Mention: ${result.hasAgeMention ? result.mentionedAge + ' ans' : 'Aucune'}`);
  console.log(`   Cohérent: ${result.isCoherent ? 'OUI' : 'NON'} (attendu: ${test.expectedOk ? 'OUI' : 'NON'})`);
  
  if (result.shouldFlag) {
    console.log(`   🚨 INCOHÉRENCE! Profil = ${result.profileAge} ans`);
  }
  
  console.log(ok ? '   [✅ PASS]' : '   [❌ FAIL]');
  if (ok) passed++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 ${passed}/${testCases.length} tests passés`);
