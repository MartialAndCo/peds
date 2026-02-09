import { personaSchedule } from '../lib/services/persona-schedule';

console.log('🕐 TEST TIMING CONTEXT\n');

// Test pour Lena (USA, timezone America/Los_Angeles)
console.log('=== LENA (USA - America/Los_Angeles) ===');
const lenaContext = personaSchedule.getContextPrompt('America/Los_Angeles', undefined, 'en');
console.log(lenaContext);

console.log('\n\n=== ANAÏS (France - Europe/Paris) ===');
const anaisContext = personaSchedule.getContextPrompt('Europe/Paris', undefined, 'fr');
console.log(anaisContext);

console.log('\n\n=== DATE ACTUELLE JS ===');
console.log('new Date():', new Date().toString());
console.log('toISOString():', new Date().toISOString());
