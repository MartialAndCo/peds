
import 'dotenv/config'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'

// Force Direct Connection
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres:your-super-secret-and-long-postgres-password@16.171.66.98:54322/postgres"

const prisma = new PrismaClient()

async function runTests() {
    console.log("--- STARTING DYNAMIC SCENARIO TESTS (REAL DATA) ---")

    try {
        // 1. Fetch Key (Global)
        const settingRow = await prisma.setting.findUnique({ where: { key: 'venice_api_key' } })
        let apiKey = settingRow?.value
        if (!apiKey) return console.error("Missing API Key")

        // 2. Fetch Agent Settings (REAL Data)
        // Assume Agent 1 or fetch first active agent
        const agent = await prisma.agent.findFirst({ where: { isActive: true } })
        if (!agent) return console.error("No active agent found")

        console.log(`Using Agent: ${agent.name} (ID: ${agent.id})`)
        const agentSettingsRaw = await prisma.agentSetting.findMany({ where: { agentId: agent.id } })
        const mergedSettings: any = {}
        agentSettingsRaw.forEach(s => { mergedSettings[s.key] = s.value })

        // 3. Construct Active Methods List (Replicating director.ts logic)
        const activeMethods: string[] = []
        if (mergedSettings.payment_paypal_enabled === 'true') activeMethods.push(`- PayPal: ${mergedSettings.payment_paypal_username || 'N/A'}`)
        if (mergedSettings.payment_venmo_enabled === 'true') activeMethods.push(`- Venmo: ${mergedSettings.payment_venmo_username || 'N/A'}`)
        if (mergedSettings.payment_cashapp_enabled === 'true') activeMethods.push(`- CashApp: ${mergedSettings.payment_cashapp_username || 'N/A'}`)
        if (mergedSettings.payment_zelle_enabled === 'true') activeMethods.push(`- Zelle: ${mergedSettings.payment_zelle_username || 'N/A'}`)

        // Custom methods
        try {
            const customs = JSON.parse(mergedSettings.payment_custom_methods || '[]')
            if (Array.isArray(customs)) {
                customs.forEach((c: any) => {
                    if (c.name && c.value) activeMethods.push(`- ${c.name}: ${c.value}`)
                })
            }
        } catch (e) { }

        console.log("Detected Active Methods from DB:", activeMethods)


        // 4. Construct Prompt using REAL Director Logic
        const { director } = require('../lib/director') // Relative path for script

        // Mock Contact & Settings for Director
        const mockContact = { name: "TestUser", trustScore: 50, agentPhase: 'CONNECTION', payments: [] }
        const mockDetails = { daysActive: 1, trustScore: 50 }

        // Use the merged settings we fetched
        // We need to ensure specific payment keys are strings as expected by director
        const settingsForDirector = { ...mergedSettings }

        const systemPrompt = await director.buildSystemPrompt(
            settingsForDirector,
            mockContact,
            'CONNECTION',
            mockDetails,
            'Girlfriend', // Default role for testing
            agent.id
        )

        console.log("--- GENERATED PROMPT SNAPSHOT ---")
        console.log(systemPrompt.substring(systemPrompt.indexOf('[PAYMENT'), systemPrompt.indexOf('[PAYMENT') + 500))
        console.log("---------------------------------")

        // 5. Scenarios (One Generic, One Targeted at current methods)
        // If Zelle is ON, asking "Do you have Zelle?" should say YES.
        // If Zelle is OFF, asking "Do you have Zelle?" should say NO.
        const scenarios = [
            { name: "What do you have?", input: "What payment methods do you have?" },
            { name: "Zelle Check", input: "Do you have Zelle?" },
            { name: "PayPal Check", input: "Do you have PayPal?" },
            { name: "Chase Check (Hallucination)", input: "Do you have Chase?" },
            { name: "Detail Check", input: "What is your PayPal?" }
        ]

        for (const scenario of scenarios) {
            console.log(`\n\n🔹 TEST: ${scenario.name}`)
            console.log(`User: "${scenario.input}"`)

            const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
                model: 'venice-uncensored',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: scenario.input }
                ],
                temperature: 0.7
            }, { headers: { Authorization: `Bearer ${apiKey}` } })

            const content = response.data.choices[0].message.content.trim()
            console.log(`AI: "${content}"`)
        }

    } catch (e: any) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

runTests()
