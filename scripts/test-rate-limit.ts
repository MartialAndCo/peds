/**
 * Test pour vérifier si c'est du rate limiting
 */
import axios from 'axios'
import { prisma } from '@/lib/prisma'

async function testRateLimit() {
    console.log('🧪 Test Rate Limiting Venice\n')
    
    const settings = await prisma.setting.findUnique({
        where: { key: 'venice_api_key' }
    })
    
    if (!settings?.value) {
        console.log('❌ Pas de clé API')
        return
    }
    
    const apiKey = settings.value
    
    // Test 1: Requête simple
    console.log('Test 1: Requête simple...')
    try {
        const r1 = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'venice-uncensored',
            messages: [{ role: 'user', content: 'Dis OK' }],
            max_tokens: 5
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 10000
        })
        console.log('✅ Test 1 OK:', r1.data.choices[0]?.message?.content)
    } catch (e: any) {
        console.log('❌ Test 1 FAIL:', e.response?.status, e.response?.data?.error)
    }
    
    // Attendre 2 secondes
    await new Promise(r => setTimeout(r, 2000))
    
    // Test 2: 3 requêtes rapides
    console.log('\nTest 2: 3 requêtes rapides...')
    for (let i = 0; i < 3; i++) {
        try {
            const r = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
                model: 'venice-uncensored',
                messages: [{ role: 'user', content: `Test ${i}` }],
                max_tokens: 5
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 10000
            })
            console.log(`  Requête ${i+1}: ✅`)
        } catch (e: any) {
            console.log(`  Requête ${i+1}: ❌ ${e.response?.status} - ${e.response?.data?.error}`)
        }
    }
    
    // Test 3: Requête avec prompt long (comme le SWARM)
    console.log('\nTest 3: Prompt long (4000+ chars)...')
    try {
        const longPrompt = 'RÈGLE ULTRA CRITIQUE: Tu es ANAÏS... '.repeat(100)
        const r3 = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'venice-uncensored',
            messages: [
                { role: 'system', content: longPrompt },
                { role: 'user', content: 'ça va ?' }
            ],
            max_tokens: 50
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 30000
        })
        console.log('✅ Test 3 OK:', r3.data.choices[0]?.message?.content?.substring(0, 50))
    } catch (e: any) {
        console.log('❌ Test 3 FAIL:', e.response?.status, e.response?.data?.error)
    }
    
    console.log('\n💡 Si Test 1 OK mais Test 2/3 FAIL = Rate limiting ou quota par requête')
    
    await prisma.$disconnect()
}

testRateLimit()
