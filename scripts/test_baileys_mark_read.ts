
import axios from 'axios'
import { settingsService } from '../lib/settings-cache'

async function main() {
    console.log("=== TESTING MARK AS READ (SEEN) API ===")

    // 1. Get Config
    const settings = await settingsService.getSettings()
    // User provided URL: http://13.60.16.81:3001
    const endpoint = 'http://13.60.16.81:3001'
    const apiKey = settings.whatsapp_api_key || 'secret_key'

    console.log(`[Config] Endpoint: ${endpoint}`)
    console.log(`[Config] API Key present: ${apiKey ? 'YES' : 'NO'}`)
    console.log(`[Config] Using API Key: ${apiKey.substring(0, 5)}...`)

    // 2. Mock Message Key (Real Structure)
    const mockKey = {
        remoteJid: '33612345678@s.whatsapp.net',
        id: 'ABCDEF1234567890',
        fromMe: false
    }

    console.log(`[Test] Sending markSeen request for:`, mockKey)

    try {
        const res = await axios.post(`${endpoint}/api/markSeen`, {
            sessionId: 'default',
            chatId: '33612345678@c.us',
            messageKey: mockKey // This was the missing part!
        }, {
            headers: { 'X-Api-Key': apiKey }
        })

        console.log("\n[Response]:", res.data)

        if (res.data.success && res.data.method) {
            console.log("\n✅ SUCCESS: Server accepted the messageKey.")
            console.log(`✅ Method used by server: ${res.data.method}`)
            if (res.data.method === 'direct_key') {
                console.log("🚀 CONFIRMED: The server is using the direct key provided. BLUE TICKS ENABLED.")
            } else {
                console.log("⚠️ WARNING: Server fell back to cache or ID. Is the fix applied / server restarted?")
            }
        } else {
            console.error("\n❌ FAILED: Server returned success=false or invalid response.")
        }

    } catch (e: any) {
        console.error("\n❌ ERROR: Could not connect to Baileys Service.")
        console.error(`Message: ${e.message}`)
        if (e.response) {
            console.error(`Status: ${e.response.status}`)
            console.error(`Data:`, e.response.data)
        }
        if (e.code === 'ECONNREFUSED') {
            console.error("HINT: Is the Baileys service running? (npm run dev in services/baileys)")
        }
    }
}

main().catch(console.error)
