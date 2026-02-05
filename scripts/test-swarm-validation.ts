/**
 * Test du validationNode avec des réponses incohérentes
 * Vérifie qu'il détecte les problèmes et régénère
 */

import { validationNode } from '@/lib/swarm/nodes/validation-node'
import { responseNode } from '@/lib/swarm/nodes/response-node'
import type { SwarmState } from '@/lib/swarm/types'

async function testValidation() {
    console.log('═'.repeat(70))
    console.log('🧪 TEST VALIDATION - Détection incohérences')
    console.log('═'.repeat(70))

    const API_KEY = process.env.VENICE_API_KEY

    const baseState: SwarmState = {
        userMessage: 'Tu peux m\'envoyer une photo ?',
        history: [
            { role: 'user', content: 'Salut' },
            { role: 'assistant', content: 'Hey' },
            { role: 'user', content: 'Tu peux m\'envoyer une photo ?' }
        ],
        contactId: 'test-contact',
        agentId: 'test-agent',
        userName: 'Marc',
        lastMessageType: 'text',
        settings: { 
            venice_api_key: API_KEY || '', 
            venice_model: 'venice-uncensored' 
        },
        contexts: {
            persona: 'Tu es Anaïs, 14 ans, ado de Paris',
            style: 'Style court, 3-6 mots, langage ado',
            phase: 'Phase CONNECTION',
            timing: 'Il est 20h, jsuis chez moi',
            memory: '',
            payment: '',
            media: '[PHOTOS] Photos dispo: selfie, face',
            voice: ''
        }
    }

    const testCases = [
        {
            name: 'Réponse trop longue (paragraphe)',
            response: 'Écoute, je comprends que tu veuilles une photo mais il faut savoir que je suis assez réservée sur ce genre de choses et je préfère attendre de mieux te connaître avant.',
            expected: 'should_fix'
        },
        {
            name: 'Style trop formel',
            response: 'Je vous prie de bien vouloir excuser mon retard dans la réponse.',
            expected: 'should_fix'
        },
        {
            name: 'Hors sujet total',
            response: 'La météo est vraiment agréable aujourd\'hui, n\'est-ce pas ?',
            expected: 'should_fix'
        },
        {
            name: 'Répétition exacte',
            response: 'Hey',
            expected: 'should_fix'
        },
        {
            name: 'Avec majuscules partout',
            response: 'OUI JE SUIS LA',
            expected: 'should_fix'
        },
        {
            name: 'Réponse correcte (ado)',
            response: 'jsuis pas à l\'aise là',
            expected: 'valid'
        },
        {
            name: 'Réponse correcte (courte)',
            response: 'j\'envoie pas de photos',
            expected: 'valid'
        }
    ]

    for (const test of testCases) {
        console.log(`\n${'─'.repeat(70)}`)
        console.log(`📝 Test: ${test.name}`)
        console.log(`💬 Réponse à tester: "${test.response.substring(0, 60)}..."`)
        console.log(`🎯 Attendu: ${test.expected === 'valid' ? '✅ Valide' : '❌ Doit être corrigé'}`)

        const state: SwarmState = {
            ...baseState,
            response: test.response
        }

        try {
            const result = await validationNode(state)
            
            console.log(`\n📊 Résultat:`)
            if (result.response === test.response) {
                console.log('   ✅ Pas de changement (considéré valide)')
                if (test.expected === 'valid') {
                    console.log('   🎯 CORRECT - La réponse était bonne')
                } else {
                    console.log('   ❌ ERREUR - Aurait dû être corrigée !')
                }
            } else {
                console.log('   🔄 Régénéré:', result.response?.substring(0, 60), '...')
                if (test.expected === 'should_fix') {
                    console.log('   🎯 CORRECT - Problème détecté et corrigé')
                } else {
                    console.log('   ⚠️ Inattendu - Réponse valide corrigée pour rien')
                }
            }
        } catch (error: any) {
            console.error(`   ❌ Erreur: ${error.message}`)
        }
    }

    console.log('\n' + '═'.repeat(70))
    console.log('🏁 Test validation terminé')
    console.log('═'.repeat(70))
}

testValidation()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Test failed:', e)
        process.exit(1)
    })
