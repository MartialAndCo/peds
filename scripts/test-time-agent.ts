/**
 * Test de l'agent temporel
 */

import { timeCoherenceAgent } from '../lib/services/time-coherence-agent';

const testCases = [
  {
    message: "Ah ouais il est déjà 20h !",
    sendTime: new Date('2026-02-06T20:35:00'), // Envoyé à 20h35
    expected: { hasTime: true, coherent: false }
  },
  {
    message: "Il est 14h, je viens de manger",
    sendTime: new Date('2026-02-06T14:05:00'), // Envoyé à 14h05
    expected: { hasTime: true, coherent: true }
  },
  {
    message: "T'es où ?",
    sendTime: new Date('2026-02-06T20:30:00'),
    expected: { hasTime: false, coherent: true }
  },
  {
    message: "Il est 8h du soir, faut que j'y aille",
    sendTime: new Date('2026-02-06T20:45:00'), // Envoyé à 20h45
    expected: { hasTime: true, coherent: true } // 5 min d'écart = cohérent
  },
  {
    message: "Déjà 22h, je vais dormir",
    sendTime: new Date('2026-02-06T22:40:00'), // Envoyé à 22h40
    expected: { hasTime: true, coherent: false } // 40 min d'écart
  }
];

console.log("🕐 TEST AGENT TEMPOREL\n");
console.log("=".repeat(60));

for (const test of testCases) {
  const result = timeCoherenceAgent.analyze(test.message, test.sendTime);
  
  console.log(`\n💬 "${test.message}"`);
  console.log(`📤 Envoi à: ${test.sendTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}`);
  console.log(`🔍 Mention: ${result.hasTimeMention ? result.mentionedHour + 'h' : 'Aucune'}`);
  console.log(`⏱️  Différence: ${result.differenceMinutes} min`);
  console.log(`✅ Cohérent: ${result.isCoherent ? 'OUI' : 'NON'}`);
  
  if (result.suggestedFix) {
    console.log(`💡 Suggestion: "${result.suggestedFix}"`);
  }
  
  // Vérification
  const status = result.hasTimeMention === test.expected.hasTime && 
                 result.isCoherent === test.expected.coherent ? '✅ OK' : '❌ FAIL';
  console.log(`[${status}]`);
}

console.log("\n" + "=".repeat(60));
console.log("🏁 TEST TERMINÉ");
