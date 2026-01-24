
import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

import { fileURLToPath } from 'url'

// Fix for ES Module scope
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function cleanSessions() {
    // Fallback to the EC2 IP found in .env for DB if not set
    const endpoint = process.env.WAHA_ENDPOINT || 'http://16.171.66.98:3001'
    const apiKey = process.env.WAHA_API_KEY || process.env.AUTH_TOKEN || 'secret'

    console.log(`Targeting Waha Server: ${endpoint}`)
    console.log('---')

    try {
        // 1. Trigger Global Cleanup (The "Clear Sessions" button action)
        console.log('1. Triggering "clear_sessions" action...')
        const actionRes = await axios.post(`${endpoint}/api/admin/action`,
            { action: 'clear_sessions' },
            { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } }
        )
        console.log('   ✅ Result:', actionRes.data)

        // 2. Force delete Session '1' (The default one showing errors in your logs)
        console.log('\n2. Force Deleting Session "1"...')
        try {
            const deleteRes = await axios.post(`${endpoint}/api/sessions/delete`,
                { sessionId: '1' },
                { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } }
            )
            console.log('   ✅ Result:', deleteRes.data)
        } catch (e: any) {
            console.log('   ℹ️  Delete info:', e.response?.data || e.message)
        }

        console.log('\nDONE. Please "Restart Container" or wait for auto-restart.')

    } catch (error: any) {
        console.error('\n❌ Error:', error.message)
        if (error.response) {
            console.error('Status:', error.response.status)
            console.error('Data:', error.response.data)
        }
    }
}

cleanSessions()
