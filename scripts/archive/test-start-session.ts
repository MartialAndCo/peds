
import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix for ES Module scope
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function startSession() {
    // Fallback to the EC2 IP if needed
    const endpoint = process.env.WAHA_ENDPOINT || 'http://16.171.66.98:3001'
    const apiKey = process.env.WAHA_API_KEY || process.env.AUTH_TOKEN || 'secret'

    console.log(`Targeting Waha Server: ${endpoint}`)
    console.log(`Using API Key: ${apiKey.substring(0, 5)}...`)

    try {
        console.log('---')
        console.log('Attempting to start session "1"...')

        const res = await axios.post(`${endpoint}/api/sessions/start`,
            { sessionId: '1' },
            { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } }
        )
        console.log('✅ Success:', res.data)

    } catch (error: any) {
        console.error('\n❌ Error:', error.message)
        if (error.response) {
            console.error('Status:', error.response.status)
            console.error('Data:', JSON.stringify(error.response.data, null, 2))
        }
    }
}

startSession()
