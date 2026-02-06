/**
 * Test exhaustif de l'agent temporel
 * 20+ scénarios en français et anglais
 */

import { timeCoherenceAgent } from '../lib/services/time-coherence-agent';

interface TestCase {
  name: string;
  message: string;
  sendTime: string; // Format "HH:MM"
  expectedHasTime: boolean;
  expectedHour?: number;
  expectedCoherent: boolean;
  lang: 'fr' | 'en';
}

const testCases: TestCase[] = [
  // === FRANÇAIS - Patterns basiques ===
  {
    name: "FR - Il est 20h (cohérent)",
    message: "Ah ouais il est déjà 20h !",
    sendTime: "20:02",
    expectedHasTime: true,
    expectedHour: 20,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - Il est 20h (incohérent +35min)",
    message: "Ah ouais il est déjà 20h !",
    sendTime: "20:35",
    expectedHasTime: true,
    expectedHour: 20,
    expectedCoherent: false,
    lang: 'fr'
  },
  {
    name: "FR - Il est 14h30 (avec minutes)",
    message: "Il est 14h30, je viens de manger",
    sendTime: "14:32",
    expectedHasTime: true,
    expectedHour: 14,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - 20 heures (format long)",
    message: "Il est 20 heures pile",
    sendTime: "20:05",
    expectedHasTime: true,
    expectedHour: 20,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - 8h du soir (20h)",
    message: "Il est 8h du soir, faut que j'y aille",
    sendTime: "20:05",
    expectedHasTime: true,
    expectedHour: 20,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - 8h du matin",
    message: "Réveillée à 8h du matin",
    sendTime: "08:05",
    expectedHasTime: true,
    expectedHour: 8,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - Cet après-midi à 15h",
    message: "On se voit cet après-midi à 15h ?",
    sendTime: "15:10",
    expectedHasTime: true,
    expectedHour: 15,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - Déjà 22h (limite 8min)",
    message: "Déjà 22h, je vais dormir",
    sendTime: "22:08",
    expectedHasTime: true,
    expectedHour: 22,
    expectedCoherent: true, // < 10min = cohérent
    lang: 'fr'
  },
  {
    name: "FR - Déjà 22h (incohérent 40min)",
    message: "Déjà 22h, je vais dormir",
    sendTime: "22:40",
    expectedHasTime: true,
    expectedHour: 22,
    expectedCoherent: false,
    lang: 'fr'
  },
  {
    name: "FR - Sans heure (négatif)",
    message: "T'es où ? J'attends depuis longtemps",
    sendTime: "20:30",
    expectedHasTime: false,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - Heure dans conversation",
    message: "Ouais grave, il est 19h passé là",
    sendTime: "19:45",
    expectedHasTime: true,
    expectedHour: 19,
    expectedCoherent: false,
    lang: 'fr'
  },
  {
    name: "FR - 12h pile (midi)",
    message: "Il est 12h, on mange ?",
    sendTime: "12:03",
    expectedHasTime: true,
    expectedHour: 12,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "FR - Minuit (00h)",
    message: "Il est minuit là, il est 00h",
    sendTime: "00:05",
    expectedHasTime: true,
    expectedHour: 0,
    expectedCoherent: true,
    lang: 'fr'
  },

  // === ANGLAIS - Patterns basiques ===
  {
    name: "EN - It's 8pm (cohérent)",
    message: "Oh it's already 8pm!",
    sendTime: "20:03",
    expectedHasTime: true,
    expectedHour: 20,
    expectedCoherent: true,
    lang: 'en'
  },
  {
    name: "EN - It's 8pm (incohérent +45min)",
    message: "Oh it's already 8pm!",
    sendTime: "20:45",
    expectedHasTime: true,
    expectedHour: 20,
    expectedCoherent: false,
    lang: 'en'
  },
  {
    name: "EN - 3:30pm (avec minutes)",
    message: "It's 3:30pm, just finished class",
    sendTime: "15:32",
    expectedHasTime: true,
    expectedHour: 15,
    expectedCoherent: true,
    lang: 'en'
  },
  {
    name: "EN - 9am morning",
    message: "Woke up at 9am",
    sendTime: "09:04",
    expectedHasTime: true,
    expectedHour: 9,
    expectedCoherent: true,
    lang: 'en'
  },
  {
    name: "EN - 11pm (23h)",
    message: "It's 11pm, going to sleep",
    sendTime: "23:05",
    expectedHasTime: true,
    expectedHour: 23,
    expectedCoherent: true,
    lang: 'en'
  },
  {
    name: "EN - 11pm incohérent",
    message: "It's 11pm, going to sleep",
    sendTime: "23:50",
    expectedHasTime: true,
    expectedHour: 23,
    expectedCoherent: false,
    lang: 'en'
  },
  {
    name: "EN - No time mention",
    message: "Where are you? Been waiting forever",
    sendTime: "21:30",
    expectedHasTime: false,
    expectedCoherent: true,
    lang: 'en'
  },
  {
    name: "EN - 12am midnight",
    message: "It's 12am, still awake",
    sendTime: "00:05",
    expectedHasTime: true,
    expectedHour: 0,
    expectedCoherent: true,
    lang: 'en'
  },
  {
    name: "EN - 12pm noon",
    message: "It's 12pm, lunch time",
    sendTime: "12:05",
    expectedHasTime: true,
    expectedHour: 12,
    expectedCoherent: true,
    lang: 'en'
  },

  // === EDGE CASES ===
  {
    name: "EDGE - Heure dans un nombre (pas une heure)",
    message: "J'ai 20 euros sur moi",
    sendTime: "15:00",
    expectedHasTime: false,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "EDGE - Date pas heure",
    message: "C'est le 20 mars aujourd'hui",
    sendTime: "20:00",
    expectedHasTime: false,
    expectedCoherent: true,
    lang: 'fr'
  },
  {
    name: "EDGE - Multiple mentions (prendre la première)",
    message: "Il est 19h, on se voit à 20h ?",
    sendTime: "20:05",
    expectedHasTime: true,
    expectedHour: 19,
    expectedCoherent: false, // 19h vs 20h05 = 65min
    lang: 'fr'
  },
  {
    name: "EDGE - Chiffres seuls (pas d'heure)",
    message: "Ouais 20 c'est bien",
    sendTime: "15:00",
    expectedHasTime: false,
    expectedCoherent: true,
    lang: 'fr'
  }
];

function createDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date('2026-02-06');
  date.setHours(hours, minutes, 0, 0);
  return date;
}

console.log("🕐 TEST EXHAUSTIF AGENT TEMPOREL\n");
console.log(`Nombre de scénarios: ${testCases.length}`);
console.log("=".repeat(70));

let passed = 0;
let failed = 0;

for (let i = 0; i < testCases.length; i++) {
  const test = testCases[i];
  const sendDate = createDate(test.sendTime);
  const result = timeCoherenceAgent.analyze(test.message, sendDate);
  
  const hasTimeOk = result.hasTimeMention === test.expectedHasTime;
  const hourOk = !test.expectedHour || result.mentionedHour === test.expectedHour;
  const coherentOk = result.isCoherent === test.expectedCoherent;
  
  const allOk = hasTimeOk && hourOk && coherentOk;
  
  console.log(`\n[${i + 1}/${testCases.length}] ${test.name}`);
  console.log(`   💬 "${test.message.substring(0, 50)}${test.message.length > 50 ? '...' : ''}"`);
  console.log(`   📤 Envoi: ${test.sendTime}`);
  console.log(`   🔍 Détecté: ${result.hasTimeMention ? `${result.mentionedHour}h` : 'Aucune'} (attendu: ${test.expectedHasTime ? test.expectedHour + 'h' : 'Aucune'})`);
  console.log(`   ⏱️  Diff: ${result.differenceMinutes}min`);
  console.log(`   ✅ Cohérent: ${result.isCoherent} (attendu: ${test.expectedCoherent})`);
  
  if (result.suggestedFix) {
    console.log(`   💡 Fix: "${result.suggestedFix.substring(0, 40)}..."`);
  }
  
  if (allOk) {
    console.log(`   [✅ PASS]`);
    passed++;
  } else {
    console.log(`   [❌ FAIL]`);
    if (!hasTimeOk) console.log(`       → hasTime: got ${result.hasTimeMention}, expected ${test.expectedHasTime}`);
    if (!hourOk) console.log(`       → hour: got ${result.mentionedHour}, expected ${test.expectedHour}`);
    if (!coherentOk) console.log(`       → coherent: got ${result.isCoherent}, expected ${test.expectedCoherent}`);
    failed++;
  }
}

console.log("\n" + "=".repeat(70));
console.log("📊 RÉSULTATS:");
console.log(`   ✅ Pass: ${passed}/${testCases.length}`);
console.log(`   ❌ Fail: ${failed}/${testCases.length}`);
console.log(`   📈 Taux: ${Math.round((passed / testCases.length) * 100)}%`);

if (failed === 0) {
  console.log("\n🎉 TOUS LES TESTS SONT PASSÉS !");
} else {
  console.log("\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ");
  process.exit(1);
}
