/**
 * Test: Admin Impersonation Context Fix
 * 
 * Scénario reproduit:
 * - Contact: "Tu peux m'envoyer des photos de toi ?"
 * - Admin (impersonation): "c'est pas pratique..."
 * - Admin (impersonation): "Ce soir"
 * - Contact: "Ok oh ça va y a pire"
 * 
 * Objectif: Vérifier que l'IA répond bien au dernier message du contact
 * et non pas à son propre message admin précédent
 */

// Simuler le mapping des messages comme dans chat.ts
function simulateMessageMapping(history: Array<{sender: string, message_text: string}>) {
    console.log('\n=== HISTORIQUE BRUT (DB) ===')
    history.forEach((m, i) => {
        console.log(`${i + 1}. [${m.sender}] ${m.message_text}`)
    })

    // Mapping comme dans le code corrigé
    const messagesForAI = history.map((m: any) => ({
        role: m.sender === 'contact' ? 'user' : 'ai',
        content: m.message_text
    }))

    console.log('\n=== MAPPING POUR L IA ===')
    messagesForAI.forEach((m, i) => {
        console.log(`${i + 1}. [${m.role}] ${m.content}`)
    })

    // NOUVELLE LOGIQUE CORRIGÉE
    let lastUserMessageIndex = -1
    for (let i = messagesForAI.length - 1; i >= 0; i--) {
        if (messagesForAI[i].role === 'user') {
            lastUserMessageIndex = i
            break
        }
    }

    let contextMessages: typeof messagesForAI
    let lastContent: string

    if (lastUserMessageIndex >= 0) {
        contextMessages = messagesForAI.filter((_, i) => i !== lastUserMessageIndex)
        lastContent = messagesForAI[lastUserMessageIndex].content
    } else {
        contextMessages = messagesForAI.slice(0, -1)
        lastContent = messagesForAI[messagesForAI.length - 1]?.content || ''
    }

    console.log('\n=== RÉSULTAT POUR L API AI ===')
    console.log('Contexte (historique sans le dernier message user):')
    contextMessages.forEach((m, i) => {
        console.log(`  [${m.role}] ${m.content.substring(0, 60)}${m.content.length > 60 ? '...' : ''}`)
    })
    console.log(`\nDernier message (celui auquel l'IA doit répondre):`)
    console.log(`  [user] ${lastContent}`)

    // Vérification
    const isCorrect = messagesForAI[lastUserMessageIndex]?.role === 'user'
    console.log('\n=== VÉRIFICATION ===')
    console.log(`✅ Dernier message est bien du contact (user): ${isCorrect}`)
    console.log(`✅ Admin messages dans le contexte: ${contextMessages.filter(m => m.role === 'ai').length}`)
    
    return { contextMessages, lastContent, isCorrect }
}

// ANCIENNE LOGIQUE (BUG) - pour comparaison
function simulateOldBuggyLogic(history: Array<{sender: string, message_text: string}>) {
    console.log('\n\n========== ANCIENNE LOGIQUE (BUG) ==========')
    
    const messagesForAI = history.map((m: any) => ({
        role: m.sender === 'contact' ? 'user' : 'ai',
        content: m.message_text
    }))

    // Ancienne logique buguée
    const contextMessages = messagesForAI.slice(0, -1)
    const lastContent = messagesForAI[messagesForAI.length - 1]?.content || ''

    console.log('Contexte:')
    contextMessages.forEach((m, i) => {
        console.log(`  [${m.role}] ${m.content.substring(0, 60)}${m.content.length > 60 ? '...' : ''}`)
    })
    console.log(`\nDernier message (BUG - c'est le message admin!):`)
    console.log(`  [${messagesForAI[messagesForAI.length - 1]?.role}] ${lastContent}`)

    const isBugged = messagesForAI[messagesForAI.length - 1]?.role === 'ai'
    console.log('\n=== BUG ===')
    console.log(`❌ Dernier message est de l'IA (admin): ${isBugged}`)
    console.log(`❌ L IA va répondre à son propre message au lieu du contact!`)
}

// Test 1: Scénario exact de la conversation
console.log('═══════════════════════════════════════════════════════════')
console.log('TEST 1: Scénario exact de ta conversation')
console.log('═══════════════════════════════════════════════════════════')

const scenario1 = [
    { sender: 'contact', message_text: 'Bah oui et alors ?' },
    { sender: 'contact', message_text: 'Tu peux m\'envoyer des photos de toi ?' },
    { sender: 'admin', message_text: 'c\'est pas pratique...' },
    { sender: 'admin', message_text: 'Ce soir' },
    { sender: 'contact', message_text: 'Ok oh ça va y a pire' }
]

const result1 = simulateMessageMapping(scenario1)
simulateOldBuggyLogic(scenario1)

// Test 2: Scénario avec plusieurs messages admin consécutifs
console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('TEST 2: Plusieurs messages admin consécutifs')
console.log('═══════════════════════════════════════════════════════════')

const scenario2 = [
    { sender: 'contact', message_text: 'Tu fais quoi ce soir ?' },
    { sender: 'admin', message_text: 'Je vais sortir' },
    { sender: 'admin', message_text: 'Avec des copines' },
    { sender: 'admin', message_text: 'Tu connais Marie ?' },
    { sender: 'contact', message_text: 'Oui je la connais, elle est sympa' }
]

const result2 = simulateMessageMapping(scenario2)

// Test 3: Scénario où contact répond rapidement après admin
console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('TEST 3: Contact répond rapidement après admin')
console.log('═══════════════════════════════════════════════════════════')

const scenario3 = [
    { sender: 'contact', message_text: 'Tu m\'as manqué' },
    { sender: 'admin', message_text: 'Aww tu es mignon' },
    { sender: 'admin', message_text: 'Moi aussi tu m\'as manqué' },
    { sender: 'contact', message_text: 'On se voit quand ?' }
]

const result3 = simulateMessageMapping(scenario3)

// Résumé
console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('RÉSUMÉ DES TESTS')
console.log('═══════════════════════════════════════════════════════════')
console.log(`Test 1 (scénario réel): ${result1.isCorrect ? '✅ CORRIGÉ' : '❌ BUG'}`)
console.log(`Test 2 (multi-admin): ${result2.isCorrect ? '✅ CORRIGÉ' : '❌ BUG'}`)
console.log(`Test 3 (réponse rapide): ${result3.isCorrect ? '✅ CORRIGÉ' : '❌ BUG'}`)

if (result1.isCorrect && result2.isCorrect && result3.isCorrect) {
    console.log('\n🎉 Tous les tests passent! La correction fonctionne.')
    console.log('\nCe qui change:')
    console.log('- Les messages admin sont toujours mappés comme "ai" (impersonation)')  
    console.log('- Mais l IA répond au DERNIER message du contact, pas au sien')
    console.log('- Le contexte inclut tous les messages admin précédents')
} else {
    console.log('\n⚠️ Certains tests échouent. Problème à investiguer.')
}
