import { personaSchedule } from '@/lib/services/persona-schedule'

console.log('🧪 Testing date injection in persona schedule...\n')

// Test FR
console.log('🇫🇷 French (Europe/Paris):')
const frContext = personaSchedule.getContextPrompt('Europe/Paris', undefined, 'fr')
console.log(frContext)
console.log('\n' + '─'.repeat(60) + '\n')

// Test EN
console.log('🇬🇧 English (America/New_York):')
const enContext = personaSchedule.getContextPrompt('America/New_York', undefined, 'en')
console.log(enContext)
console.log('\n' + '─'.repeat(60) + '\n')

// Test avec date spécifique (5 février 2026 = jeudi)
console.log('📅 Specific date test (5 Feb 2026):')
const specificDate = new Date('2026-02-05T14:30:00')
const specificContext = personaSchedule.getContextPrompt('Europe/Paris', specificDate, 'fr')
console.log(specificContext)
