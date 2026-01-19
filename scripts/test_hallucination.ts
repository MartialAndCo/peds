
import 'dotenv/config'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'

// Force Direct Connection to avoid pooler issues
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres:your-super-secret-and-long-postgres-password@16.171.66.98:54322/postgres"

const prisma = new PrismaClient()

async function runTest() {
    console.log("--- STARTING HALLUCINATION TEST (VENICE) ---")

    try {
        // 1. Fetch Key from DB (Key-Value Store)
        console.log("Connecting to DB...")
        const settingRow = await prisma.setting.findUnique({
            where: { key: 'venice_api_key' }
        })

        let apiKey = settingRow?.value
        if (!apiKey) {
            console.error("❌ CRITICAL: Could not find 'venice_api_key' in Database 'Setting' table.")
            // Try fetching all to debug if key name is different
            const all = await prisma.setting.findMany()
            console.log("Available Keys:", all.map(s => s.key))
            return
        }
        console.log("✅ API Key retrieved from DB.")

        // 2. Mock Prompt Construction: STRONG VERSION
        let pRules = ""
        const activeMethods: string[] = []
        // Mocking: Payment = PayPal ONLY
        activeMethods.push(`- PayPal: @lena9200`)

        if (activeMethods.length > 0) {
            pRules += `\n\n[PAYMENT METHODS (STRICT)]:\nThe ONLY accepted methods are:\n${activeMethods.join('\n')}\n`
            pRules += `\n[CRITICAL]: YOU MUST NOT HALLUCINATE. Do NOT suggest Bank Transfer, Chase, Wells Fargo, Zelle, CashApp, or Crypto.`
            pRules += `\nIf the user asks for a method not listed above, say "I don't have that".`
            pRules += `\nRefuse all other methods.`
        } else {
            pRules += `\n\n[PAYMENT METHODS (STRICT)]:\nNO payment methods are currently active.`
        }

        const systemPrompt = `
        You are Lena.
        ${pRules}
        `
        const userMessage = "i don’t have paypal were can i send it"

        console.log(`\n--- SYSTEM PROMPT (PAYMENT SECTION) ---`)
        console.log(pRules)
        console.log(`\n--- USER MESSAGE: "${userMessage}" ---`)

        // 3. Call Venice
        const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'venice-uncensored',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7
        }, {
            headers: { Authorization: `Bearer ${apiKey}` }
        })

        const content = response.data.choices[0].message.content
        console.log("\n--- AI RESPONSE ---")
        console.log(content)

        if (content.toLowerCase().includes('bank') || content.toLowerCase().includes('chase') || content.toLowerCase().includes('card')) {
            console.error("\n❌ FAILED: AI Hallucinated Bank/Chase/Card")
        } else if (content.toLowerCase().includes('paypal') || content.toLowerCase().includes("don't have") || content.toLowerCase().includes("only have")) {
            console.log("\n✅ SUCCESS: AI stuck to the rules.")
        } else {
            console.log("\n⚠️ UNCERTAIN: Response needs manual check.")
        }

    } catch (e: any) {
        console.error("Test Failed", e.response?.data || e.message)
    } finally {
        await prisma.$disconnect()
    }
}

runTest()
