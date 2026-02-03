/**
 * Test AI Queue Awareness Decisions
 * Run with: npx ts-node scripts/test-queue-awareness.ts
 */

import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

const VENICE_API_KEY = process.env.VENICE_API_KEY || ''

const SCENARIOS = [
    {
        name: "Lead répond OK - Garder le message",
        pending: [
            { id: "42", type: "Text", content: "T'es occupée ce soir ?", time: "22:30" }
        ],
        newMessage: "Ok",
        expectedAction: "KEEP" // Le "Ok" ne change rien, le message planifié reste valide
    },
    {
        name: "Lead pose nouvelle question - Répondre aux deux",
        pending: [
            { id: "43", type: "Text", content: "Moi j'aime bien les films d'horreur", time: "22:32" }
        ],
        newMessage: "Tu fais quoi ce weekend ?",
        expectedAction: "KEEP" // Les deux messages sont valides
    },
    {
        name: "Lead dit bonne nuit après AI dit je vais dormir - Annuler",
        pending: [
            { id: "44", type: "Text", content: "Tu fais quoi là ?", time: "22:35" }
        ],
        newMessage: "Ok bonne nuit alors !",
        conversationContext: "AI venait de dire 'je vais dormir'",
        expectedAction: "CANCEL" // Incohérent de demander "tu fais quoi" après bonne nuit
    },
    {
        name: "Lead envoie emoji - Garder",
        pending: [
            { id: "45", type: "Text", content: "Sérieux ? Raconte mdr", time: "22:38" }
        ],
        newMessage: "😂",
        expectedAction: "KEEP" // Un emoji ne change pas le flow
    },
    {
        name: "Lead change de sujet drastiquement - Evaluer",
        pending: [
            { id: "46", type: "Text", content: "Ouais le film était trop bien!", time: "22:40" }
        ],
        newMessage: "Tu peux m'envoyer une photo ?",
        expectedAction: "CANCEL" // Le sujet a changé, mieux vaut répondre à la vraie question
    },
    {
        name: "Vocal en attente + nouveau message - JAMAIS annuler vocal",
        pending: [
            { id: "47", type: "Voice", content: "[Voice Message]", time: "22:42" }
        ],
        newMessage: "T'es là ?",
        expectedAction: "KEEP" // Vocal = prioritaire, ne jamais annuler
    },
    {
        name: "Double message lead pendant délai - Fusionner réponse",
        pending: [
            { id: "48", type: "Text", content: "Haha trop drôle", time: "22:44" }
        ],
        newMessage: "En vrai t'as quel âge ?",
        expectedAction: "CANCEL" // Mieux vaut répondre à la question plutôt qu'envoyer un "haha" random
    }
]

async function runTest() {
    console.log("🧪 Testing AI Queue Awareness Decisions\n")
    console.log("=".repeat(60) + "\n")

    const results: { name: string, expected: string, actual: string, pass: boolean }[] = []

    for (const scenario of SCENARIOS) {
        console.log(`📋 Scenario: ${scenario.name}`)
        console.log(`   Pending: ${scenario.pending.map(p => `[${p.type}] "${p.content}"`).join(', ')}`)
        console.log(`   New Message: "${scenario.newMessage}"`)
        console.log(`   Expected: ${scenario.expectedAction}`)

        // Build the prompt like chat.ts does
        const queueContext = scenario.pending.map(item =>
            `- ID:${item.id} (${item.type}, ${item.time}): "${item.content}"`
        ).join('\n')

        const systemPrompt = `Tu es Anaïs, une jeune femme de 19 ans. Tu discutes avec quelqu'un sur les réseaux.

${scenario.conversationContext ? `[Contexte]: ${scenario.conversationContext}\n` : ''}
[MESSAGES EN ATTENTE D'ENVOI]
${queueContext}
[/MESSAGES EN ATTENTE]

Tu as des messages en attente d'envoi. Analyse si le nouveau message du lead change le contexte:
- Si le message en attente reste pertinent → réponds normalement SANS utiliser [CANCEL]
- Si le message en attente devient incohérent ou hors sujet → utilise [CANCEL:ID] puis réponds
- Les VOCAUX ne s'annulent JAMAIS

Réponds naturellement comme tu le ferais.`

        try {
            const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
                model: "llama-3.3-70b",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: scenario.newMessage }
                ],
                max_tokens: 150,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${VENICE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            })

            const aiResponse = response.data.choices[0]?.message?.content || ""
            const hasCancelToken = /\[CANCEL:\d+\]/i.test(aiResponse)
            const actualAction = hasCancelToken ? "CANCEL" : "KEEP"
            const pass = actualAction === scenario.expectedAction

            console.log(`   AI Response: "${aiResponse.substring(0, 80)}${aiResponse.length > 80 ? '...' : ''}"`)
            console.log(`   Actual: ${actualAction}`)
            console.log(`   ${pass ? '✅ PASS' : '❌ FAIL'}`)
            console.log()

            results.push({ name: scenario.name, expected: scenario.expectedAction, actual: actualAction, pass })

            // Small delay between calls
            await new Promise(r => setTimeout(r, 500))

        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`)
            console.log()
            results.push({ name: scenario.name, expected: scenario.expectedAction, actual: "ERROR", pass: false })
        }
    }

    // Summary
    console.log("=".repeat(60))
    console.log("📊 SUMMARY")
    console.log("=".repeat(60))
    const passed = results.filter(r => r.pass).length
    const total = results.length
    console.log(`\nPassed: ${passed}/${total} (${Math.round(passed / total * 100)}%)`)

    if (passed < total) {
        console.log("\n❌ Failed scenarios:")
        results.filter(r => !r.pass).forEach(r => {
            console.log(`   - ${r.name}: Expected ${r.expected}, Got ${r.actual}`)
        })
    }
}

runTest().catch(console.error)
