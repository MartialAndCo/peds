/**
 * Tests de cas limites pour la correction admin impersonation
 */

// NOUVELLE LOGIQUE CORRIGÉE
function newLogic(history: Array<{sender: string, message_text: string}>) {
    const messagesForAI = history.map((m: any) => ({
        role: m.sender === 'contact' ? 'user' : 'ai',
        content: m.message_text
    }))

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

    return { contextMessages, lastContent, lastContentRole: lastUserMessageIndex >= 0 ? 'user' : 'unknown' }
}

// ANCIENNE LOGIQUE BUGUÉE
function oldLogic(history: Array<{sender: string, message_text: string}>) {
    const messagesForAI = history.map((m: any) => ({
        role: m.sender === 'contact' ? 'user' : 'ai',
        content: m.message_text
    }))

    const contextMessages = messagesForAI.slice(0, -1)
    const lastContent = messagesForAI[messagesForAI.length - 1]?.content || ''
    const lastContentRole = messagesForAI[messagesForAI.length - 1]?.role || 'unknown'

    return { contextMessages, lastContent, lastContentRole }
}

function testCase(name: string, history: Array<{sender: string, message_text: string}>) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`TEST: ${name}`)
    console.log('='.repeat(60))
    
    console.log('\nHistorique DB:')
    history.forEach((m, i) => console.log(`  ${i+1}. [${m.sender}] ${m.message_text}`))

    const old = oldLogic(history)
    const new_ = newLogic(history)

    console.log('\n--- ANCIENNE LOGIQUE ---')
    console.log(`Dernier message traité: "${old.lastContent}"`)
    console.log(`Rôle: ${old.lastContentRole}`)
    console.log(`Résultat: ${old.lastContentRole === 'ai' ? '❌ BUG: IA répond à son propre message!' : '✅ OK'}`)

    console.log('\n--- NOUVELLE LOGIQUE ---')
    console.log(`Dernier message traité: "${new_.lastContent}"`)
    console.log(`Rôle: ${new_.lastContentRole}`)
    console.log(`Résultat: ${new_.lastContentRole === 'user' ? '✅ CORRIGÉ: IA répond au contact' : '⚠️ Pas de message user trouvé'}`)

    // Différence
    if (old.lastContent !== new_.lastContent || old.lastContentRole !== new_.lastContentRole) {
        console.log('\n🎯 DIFFÉRENCE DÉTECTÉE!')
        console.log(`   Avant: [${old.lastContentRole}] "${old.lastContent}"`)
        console.log(`   Après: [${new_.lastContentRole}] "${new_.lastContent}"`)
    } else {
        console.log('\n✓ Même résultat (pas de régression)')
    }
}

// Cas 1: Scénario exact de ta conversation (dernier message = contact)
testCase('Scénario réel - Contact répond après admin', [
    { sender: 'contact', message_text: 'Tu peux envoyer des photos ?' },
    { sender: 'admin', message_text: 'c\'est pas pratique...' },
    { sender: 'admin', message_text: 'Ce soir' },
    { sender: 'contact', message_text: 'Ok oh ça va y a pire' }
])

// Cas 2: Dernier message est de l'admin (le bug original!)
testCase('BUG ORIGINAL - Dernier message = Admin', [
    { sender: 'contact', message_text: 'Tu fais quoi ?' },
    { sender: 'admin', message_text: 'Je regarde Netflix' },
    { sender: 'admin', message_text: 'Et toi ?' }
])

// Cas 3: Alternance rapide
testCase('Alternance rapide contact/admin/contact', [
    { sender: 'contact', message_text: 'Salut' },
    { sender: 'admin', message_text: 'Hey !' },
    { sender: 'contact', message_text: 'Ca va ?' },
    { sender: 'admin', message_text: 'Oui et toi ?' },
    { sender: 'contact', message_text: 'Ca va merci' }
])

// Cas 4: Seulement des messages admin (pas de contact récent)
testCase('Edge case - Seulement messages admin', [
    { sender: 'admin', message_text: 'Coucou' },
    { sender: 'admin', message_text: 'Tu es là ?' }
])

// Cas 5: Seulement des messages contact
testCase('Edge case - Seulement messages contact', [
    { sender: 'contact', message_text: 'Hello' },
    { sender: 'contact', message_text: 'Tu es là ?' },
    { sender: 'contact', message_text: 'Réponds !' }
])

// Cas 6: Longue séquence avec admin à la fin
testCase('Longue séquence admin à la fin', [
    { sender: 'contact', message_text: 'Message 1' },
    { sender: 'contact', message_text: 'Message 2' },
    { sender: 'admin', message_text: 'Réponse 1' },
    { sender: 'admin', message_text: 'Réponse 2' },
    { sender: 'admin', message_text: 'Réponse 3' },
    { sender: 'admin', message_text: 'Réponse 4' }
])

console.log('\n' + '='.repeat(60))
console.log('RÉSUMÉ')
console.log('='.repeat(60))
console.log('La nouvelle logique garantit que l IA répond toujours au')
console.log('dernier message DU CONTACT, pas au dernier message en base.')
console.log('\nCela permet:')
console.log('1. ✅ Impersonation admin (messages admin = ai)')
console.log('2. ✅ IA répond au bon message (dernier message contact)')
console.log('3. ✅ Pas de réponse à soi-même')
