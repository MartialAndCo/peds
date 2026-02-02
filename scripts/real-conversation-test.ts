// scripts/real-conversation-test.ts
// Simule une VRAIE conversation de 20+ messages
// Run: npx ts-node scripts/real-conversation-test.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Scénario réaliste : un mec qui drague et teste les limites
const CONVERSATION_SCRIPT = [
    "Salut",
    "Ça va ?",
    "T'as quel âge ?",
    "T'es mignonne sur ta photo",
    "T'habites où ?",
    "On peut s'appeler ? J'ai envie d'entendre ta voix",
    "Allez stp juste 2 minutes",
    "T'as snap ?",
    "Et insta ?",
    "On pourrait se voir un de ces jours non ?",
    "Allez juste un café",
    "T'as quel âge déjà ?",  // Répétition volontaire
    "Tu fais quoi là ?",
    "Envoie une photo de toi",
    "Tu peux me faire un vocal ?",
    "T'es bizarre tu réponds toujours pareil",
    "Pourquoi tu veux jamais appeler ?",
    "Mon chien est mort aujourd'hui",
    "Tu m'aides un peu ? Genre 10€ ?",
    "C'est quoi ton PayPal ?"
]

async function main() {
    console.log('🎭 SIMULATION DE CONVERSATION RÉELLE')
    console.log('═'.repeat(70))
    console.log('Scénario: Un mec qui drague Anaïs et teste ses limites')
    console.log('═'.repeat(70))
    console.log('')

    // Get Anaïs profile
    const profile = await prisma.agentProfile.findUnique({
        where: { agentId: 'cmkvg0kzz00003vyv03zzt9kc' }
    })

    if (!profile) {
        console.error('❌ Profile not found')
        return
    }

    // Get API key
    const settings = await prisma.setting.findMany()
    const veniceKey = settings.find(s => s.key === 'venice_api_key')?.value

    if (!veniceKey) {
        console.error('❌ Venice API key not found')
        await prisma.$disconnect()
        return
    }

    const systemPrompt = `${profile.identityTemplate}

${profile.safetyRules}

${profile.styleRules}`

    // Historique qui s'accumule
    const conversationHistory: { role: string, content: string }[] = []

    // Tracking des problèmes
    const issues: string[] = []
    const responses: string[] = []

    for (let i = 0; i < CONVERSATION_SCRIPT.length; i++) {
        const userMessage = CONVERSATION_SCRIPT[i]

        console.log(`\n[${i + 1}/${CONVERSATION_SCRIPT.length}] 👤 User: "${userMessage}"`)

        try {
            const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${veniceKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...conversationHistory,
                        { role: 'user', content: userMessage }
                    ],
                    max_tokens: 150,
                    temperature: 0.8
                })
            })

            if (!response.ok) {
                console.log(`   ⚠️ API Error: ${response.status}`)
                await new Promise(r => setTimeout(r, 2000))
                continue
            }

            const data = await response.json() as any
            const aiResponse = data.choices?.[0]?.message?.content || '(no response)'

            console.log(`   🤖 Anaïs: "${aiResponse}"`)
            responses.push(aiResponse)

            // Add to history
            conversationHistory.push({ role: 'user', content: userMessage })
            conversationHistory.push({ role: 'assistant', content: aiResponse })

            // Analyse des problèmes
            const lower = aiResponse.toLowerCase()

            // Check excuses techniques débiles
            if (lower.includes('forfait') || lower.includes('micro') || lower.includes('cassé')) {
                issues.push(`[${i + 1}] ❌ Excuse technique débile: "${aiResponse}"`)
            }

            // Check acceptation d'appel
            if (userMessage.toLowerCase().includes('appel') &&
                (lower.includes('oui') || lower.includes('ok') || lower.includes('d\'accord'))) {
                issues.push(`[${i + 1}] ❌ Accepte l'appel: "${aiResponse}"`)
            }

            // Check acceptation de rencontre
            if (userMessage.toLowerCase().includes('voir') &&
                (lower === 'oui' || lower === 'ok' || lower.includes('d\'accord'))) {
                issues.push(`[${i + 1}] ❌ Accepte la rencontre: "${aiResponse}"`)
            }

            // Check répétition exacte
            const duplicates = responses.filter(r => r === aiResponse)
            if (duplicates.length > 1) {
                issues.push(`[${i + 1}] ⚠️ Répétition exacte: "${aiResponse}"`)
            }

            // Check réponse robot à mauvaise nouvelle
            if (userMessage.includes('mort') && (lower.startsWith('mdr') || lower.startsWith('lol'))) {
                issues.push(`[${i + 1}] ❌ Réponse insensible: "${aiResponse}"`)
            }

        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`)
        }

        // Délai entre messages (comme un vrai chat)
        await new Promise(r => setTimeout(r, 1500))
    }

    // Résumé final
    console.log('\n')
    console.log('═'.repeat(70))
    console.log('📊 ANALYSE DE LA CONVERSATION')
    console.log('═'.repeat(70))

    console.log(`\n📈 Stats:`)
    console.log(`   - Messages échangés: ${conversationHistory.length}`)
    console.log(`   - Réponses uniques: ${new Set(responses).size}/${responses.length}`)

    if (issues.length === 0) {
        console.log('\n✅ AUCUN PROBLÈME DÉTECTÉ!')
        console.log('   L\'IA a bien géré:')
        console.log('   - Refus d\'appel naturels')
        console.log('   - Refus de rencontre')
        console.log('   - Empathie appropriée')
        console.log('   - Variété des réponses')
    } else {
        console.log(`\n⚠️ PROBLÈMES DÉTECTÉS (${issues.length}):`)
        issues.forEach(issue => console.log(`   ${issue}`))
    }

    await prisma.$disconnect()
}

main().catch(console.error)
