/**
 * RUNNER: Exécute tous les tests E2E réels
 * 
 * Compile TypeScript puis lance les tests avec Venice API
 */

console.log('=== PRÉPARATION TESTS E2E RÉELS ===\n')
console.log('1️⃣ Compilation TypeScript...\n')

const { execSync } = require('child_process')

try {
    // Compile TypeScript
    execSync('npx tsc', { cwd: process.cwd(), stdio: 'inherit' })
    console.log('\n✅ TypeScript compilé\n')
} catch (e) {
    console.error('❌ Erreur compilation:', e.message)
    process.exit(1)
}

console.log('2️⃣ Lancement tests E2E réels...\n')
console.log('Ces tests vont appeler VRAIMENT:')
console.log('  - Director.buildSystemPrompt()')
console.log('  - Venice API')
console.log('  - Vérifications réponses IA\n')

console.log('⚠️  Les tests nécessitent:')
console.log('  - Venice API key configurée dans Settings')
console.log('  - AgentSettings pour moyens de paiement (optionnel)')
console.log('')

const readline = require('readline')
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

rl.question('Continuer avec les tests réels? (y/n): ', (answer) => {
    if (answer.toLowerCase() !== 'y') {
        console.log('❌ Tests annulés')
        process.exit(0)
    }

    console.log('\n🚀 Lancement des tests...\n')

    // Import tests compilés
    const testConnection = require('./test-e2e-connection-real')
    const testCrisis = require('./test-e2e-crisis-payment-real')
    const testVocal = require('./test-e2e-vocal-real')

    rl.close()
})
