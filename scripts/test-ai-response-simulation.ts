/**
 * Simulation de réponse IA - Avant vs Après correction
 * 
 * Ce script montre comment l'IA interprète le contexte différemment
 */

// Simule le format des messages envoyés à l'API Venice/Claude
function formatForAPI(contextMessages: Array<{role: string, content: string}>, lastContent: string) {
    const messages = [
        { role: 'system', content: '[System Prompt... Tu es Anaïs, 22 ans, tu parles comme une copine]' },
        ...contextMessages,
        { role: 'user', content: lastContent }
    ]
    return messages
}

// Affiche ce que l'IA "voit"
function showAIPerspective(name: string, contextMessages: Array<{role: string, content: string}>, lastContent: string) {
    console.log(`\n🤖 ${name}`)
    console.log('─'.repeat(50))
    
    const apiMessages = formatForAPI(contextMessages, lastContent)
    
    apiMessages.forEach((m, i) => {
        const role = m.role === 'system' ? '🔧 SYSTEM' : 
                     m.role === 'user' ? '👤 USER (Marc)' : '🤖 ASSISTANT (Moi/Anaïs)'
        const content = m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content
        console.log(`${role}: ${content}`)
    })
    
    console.log('\n📊 Analyse:')
    const lastRole = apiMessages[apiMessages.length - 1].role
    if (lastRole === 'user') {
        console.log('   ✅ L\'IA voit un message du USER à traiter')
        console.log('   ✅ Elle va répondre à ce message')
    } else {
        console.log('   ❌ L\'IA voit son propre message comme dernier')
        console.log('   ❌ Elle risque de se répéter ou être confuse')
    }
}

console.log('═══════════════════════════════════════════════════════════')
console.log('SIMULATION: Conversation avec impersonation admin')
console.log('═══════════════════════════════════════════════════════════')

// Scénario réel
const dbHistory = [
    { sender: 'contact', message_text: 'Tu peux m\'envoyer des photos de toi ?' },
    { sender: 'admin', message_text: 'c\'est pas pratique...' },
    { sender: 'admin', message_text: 'Ce soir' },
    { sender: 'contact', message_text: 'Ok oh ça va y a pire' }
]

console.log('\n📱 Historique WhatsApp (DB):')
dbHistory.forEach((m, i) => {
    const icon = m.sender === 'contact' ? '👤 Marc' : '👩‍💼 Anaïs (admin)'
    console.log(`   ${i+1}. ${icon}: ${m.message_text}`)
})

// ANCIENNE LOGIQUE BUGUÉE
console.log('\n\n' + '═'.repeat(60))
console.log('AVANT CORRECTION (potentiellement bugué selon l\'ordre)')
console.log('═'.repeat(60))

const buggyMessagesForAI = dbHistory.map(m => ({
    role: m.sender === 'contact' ? 'user' : 'ai',
    content: m.message_text
}))
const buggyContext = buggyMessagesForAI.slice(0, -1)
const buggyLast = buggyMessagesForAI[buggyMessagesForAI.length - 1].content
const buggyLastRole = buggyMessagesForAI[buggyMessagesForAI.length - 1].role

showAIPerspective('Ce que l\'IA recevait', buggyContext, buggyLast)

console.log('\n🎭 Comportement observé:')
if (buggyLastRole === 'ai') {
    console.log('   ❌ L\'IA pense avoir déjà répondu "Ok oh ça va y a pire"')
    console.log('   ❌ Elle risque de répéter "Ce soir" ou d\'être confuse')
    console.log('   ❌ Elle ne réagit pas au message "Ok oh ça va y a pire"')
} else {
    console.log('   ⚠️  Dans ce cas précis, le dernier message était du contact')
    console.log('   ⚠️  Mais si l\'admin envoie le dernier message -> BUG')
}

// NOUVELLE LOGIQUE CORRIGÉE
console.log('\n\n' + '═'.repeat(60))
console.log('APRÈS CORRECTION')
console.log('═'.repeat(60))

// Trouve le dernier message user
let lastUserIdx = -1
for (let i = buggyMessagesForAI.length - 1; i >= 0; i--) {
    if (buggyMessagesForAI[i].role === 'user') {
        lastUserIdx = i
        break
    }
}

const fixedContext = buggyMessagesForAI.filter((_, i) => i !== lastUserIdx)
const fixedLast = buggyMessagesForAI[lastUserIdx].content

showAIPerspective('Ce que l\'IA reçoit maintenant', fixedContext, fixedLast)

console.log('\n🎭 Comportement attendu:')
console.log('   ✅ L\'IA voit bien "Ok oh ça va y a pire" comme message à traiter')
console.log('   ✅ Elle voit aussi ses "propres" messages précédents (impersonation)')
console.log('   ✅ Elle peut répondre naturellement en continuité')

// Exemple de ce que l'IA pourrait répondre
console.log('\n\n💬 Exemple de réponse possible:')
console.log('   👤 Marc: Ok oh ça va y a pire')
console.log('   🤖 Anaïs: Haha t\'es trop marrant 😂')
console.log('   🤖 Anaïs: Mais si tu veux vraiment des photos, envoie moi un msg ce soir')
console.log('   🤖 Anaïs: Là je suis encore au taff et j\'ai pas trop le temps 📸')

// Deuxième scénario: Le vrai bug
console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('SCÉNARIO 2: Le vrai bug (dernier message = admin)')
console.log('═══════════════════════════════════════════════════════════')

const dbHistory2 = [
    { sender: 'contact', message_text: 'Tu fais quoi ?' },
    { sender: 'admin', message_text: 'Je regarde Netflix' },
    { sender: 'admin', message_text: 'Et toi ?' }
]

console.log('\n📱 Historique WhatsApp (DB):')
dbHistory2.forEach((m, i) => {
    const icon = m.sender === 'contact' ? '👤 Marc' : '👩‍💼 Anaïs (admin)'
    console.log(`   ${i+1}. ${icon}: ${m.message_text}`)
})

// AVANT
console.log('\n\n' + '═'.repeat(60))
console.log('AVANT - L\'IA reçoit:')
console.log('═'.repeat(60))
console.log('   [user] Tu fais quoi ?')
console.log('   [ai] Je regarde Netflix')
console.log('   [user] Et toi ?  ← BUG! C\'est traité comme message du contact!')
console.log('\n❌ L\'IA pense que Marc a dit "Et toi ?"')
console.log('❌ Elle va répondre à ça au lieu de traiter le vrai message précédent')

// APRÈS
console.log('\n\n' + '═'.repeat(60))
console.log('APRÈS - L\'IA reçoit:')
console.log('═'.repeat(60))
console.log('   [user] Tu fais quoi ?  ← Vrai message à traiter')
console.log('   [ai] Je regarde Netflix')
console.log('   [ai] Et toi ?  ← Dans le contexte comme message de l\'IA')
console.log('\n✅ L\'IA répond bien à "Tu fais quoi ?"')
console.log('✅ Tout en gardant le contexte de ses "propres" messages')

console.log('\n\n═══════════════════════════════════════════════════════════')
console.log('CONCLUSION')
console.log('═══════════════════════════════════════════════════════════')
console.log('Avant: L\'IA pouvait répondre à un message admin (se tromper de destinataire)')
console.log('Après: L\'IA répond toujours au dernier message du contact (cohérent)')
console.log('\nEt l\'impersonation fonctionne toujours:')
console.log('- Tes messages admin sont vus comme venant de l\'IA')
console.log('- Ils apparaissent dans le contexte comme messages de l\'IA')
console.log('- L\'IA continue la conversation naturellement')
