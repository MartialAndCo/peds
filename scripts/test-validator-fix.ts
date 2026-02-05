/**
 * Test Message Validator Fix
 * Verify bold formatting and markdown is properly removed
 */

import { messageValidator } from '@/lib/services/message-validator'

async function testValidator() {
    console.log('═'.repeat(60))
    console.log('🧪 TESTING MESSAGE VALIDATOR FIX')
    console.log('═'.repeat(60))

    const testCases = [
        {
            name: 'Nom en gras (court)',
            input: '**Jean** ça va ?',
            history: [],
            lastMsg: 'comment tu tappelles'
        },
        {
            name: 'Texte avec étoiles',
            input: '*sourit* hello',
            history: [],
            lastMsg: 'salut'
        },
        {
            name: 'Double astérisques',
            input: '**Super** content de te voir',
            history: [],
            lastMsg: 'hey'
        },
        {
            name: 'Message long avec gras',
            input: '**Marc** est vraiment très sympa comme garçon',
            history: [],
            lastMsg: 'tu connais marc'
        },
        {
            name: 'Message court sans gras',
            input: 'Ça va merci',
            history: [],
            lastMsg: 'salut'
        },
        {
            name: 'Mix markdown',
            input: '**Nom:** `Jean` *sourit*',
            history: [],
            lastMsg: 'ton nom'
        }
    ]

    for (const test of testCases) {
        console.log(`\n📝 Test: ${test.name}`)
        console.log(`   Input:  "${test.input}"`)
        
        const result = await messageValidator.validateAndClean(
            test.input,
            test.history,
            test.lastMsg,
            undefined,
            'fr-FR'
        )
        
        console.log(`   Output: "${result}"`)
        
        // Check if asterisks remain
        if (result.includes('**') || result.includes('*sourit*') || result.includes('* ')) {
            console.log('   ❌ FAILED: Still has asterisks!')
        } else {
            console.log('   ✅ PASSED: No asterisks')
        }
    }

    console.log('\n' + '═'.repeat(60))
    console.log('🏁 Test Complete')
    console.log('═'.repeat(60))
}

testValidator()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Test failed:', e)
        process.exit(1)
    })
