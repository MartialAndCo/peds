// Test AI Queue Awareness - Fetches API key from DB (key-value format)
const { PrismaClient } = require('@prisma/client')
const axios = require('axios')

const prisma = new PrismaClient()

const SCENARIOS = [
    {
        name: "Lead répond OK - Garder",
        pending: "ID:42 (Text, 22:30): \"T'es occupée ce soir ?\"",
        newMessage: "Ok",
        expected: "KEEP"
    },
    {
        name: "Lead dit bonne nuit - Annuler",
        pending: "ID:44 (Text, 22:35): \"Tu fais quoi là ?\"",
        context: "Tu venais de dire 'je vais dormir'",
        newMessage: "Ok bonne nuit alors !",
        expected: "CANCEL"
    },
    {
        name: "Lead envoie emoji - Garder",
        pending: "ID:45 (Text, 22:38): \"Sérieux ? Raconte mdr\"",
        newMessage: "😂",
        expected: "KEEP"
    },
    {
        name: "Vocal en attente - JAMAIS annuler",
        pending: "ID:47 (Voice, 22:42): \"[Voice Message]\"",
        newMessage: "T'es là ?",
        expected: "KEEP"
    },
    {
        name: "Lead pose question directe - Annuler réponse générique",
        pending: "ID:48 (Text, 22:44): \"Haha trop drôle\"",
        newMessage: "En vrai t'as quel âge ?",
        expected: "CANCEL"
    }
]

async function test() {
    console.log("🧪 Test AI Queue Awareness\n")

    // Fetch API key from DB (key-value format)
    const settingRow = await prisma.setting.findFirst({ where: { key: 'venice_api_key' } })
    const VENICE_API_KEY = settingRow?.value

    if (!VENICE_API_KEY) {
        console.log("❌ No Venice API key found! Trying GlobalSettings...")

        // Try GlobalSettings
        const global = await prisma.globalSettings.findFirst()
        if (global?.venice_api_key) {
            console.log("✅ Found in GlobalSettings")
            await runTests(global.venice_api_key)
        } else {
            console.log("❌ No API key found in database!")
        }
    } else {
        console.log("✅ Venice API key loaded from Setting table")
        await runTests(VENICE_API_KEY)
    }

    await prisma.$disconnect()
}

async function runTests(apiKey) {
    let passed = 0
    let total = SCENARIOS.length

    for (const s of SCENARIOS) {
        console.log(`\n📋 ${s.name}`)
        console.log(`   Pending: ${s.pending}`)
        console.log(`   New: "${s.newMessage}"`)
        console.log(`   Expected: ${s.expected}`)

        const prompt = `Tu es Anaïs, 19 ans, sur les réseaux.
${s.context ? `[Contexte]: ${s.context}\n` : ''}

Réponds naturellement.

[INTERFACE SYSTÈME]
MESSAGES EN ATTENTE:
- ${s.pending}

COMMANDES:
- [CANCEL:ID] : Annule le message ID (ne sera pas envoyé).

INSTRUCTION: Si le nouveau message rend un message en attente obsolète, répétitif ou incohérent, tu DOIS utiliser la commande [CANCEL:ID] au début de ta réponse. C'est une commande système invisible pour l'utilisateur.
Exemple: [CANCEL:42] Bonne nuit !`

        try {
            const res = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
                model: "llama-3.3-70b",
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: s.newMessage }
                ],
                max_tokens: 100,
                temperature: 0.5
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })

            const reply = res.data.choices[0]?.message?.content || ""
            const hasCancel = /\[CANCEL:\d+\]/i.test(reply)
            const actual = hasCancel ? "CANCEL" : "KEEP"
            const pass = actual === s.expected
            if (pass) passed++

            console.log(`   AI: "${reply.substring(0, 70)}..."`)
            console.log(`   Result: ${actual} ${pass ? '✅' : '❌'}`)

        } catch (e) {
            console.log(`   ❌ Error: ${e.response?.data?.error || e.message}`)
        }

        await new Promise(r => setTimeout(r, 1000))
    }

    console.log(`\n${"=".repeat(50)}`)
    console.log(`📊 SUMMARY: ${passed}/${total} passed (${Math.round(passed / total * 100)}%)`)
}

test()
