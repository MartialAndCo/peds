
import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function triggerGitPull() {
    const endpoint = process.env.WAHA_ENDPOINT || 'http://localhost:3000'
    const apiKey = process.env.WAHA_API_KEY || 'secret'

    console.log(`Triggering Git Pull on Waha Server: ${endpoint}`)

    try {
        const response = await axios.post(`${endpoint}/api/admin/action`, {
            action: 'git_pull'
        }, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            }
        })

        console.log('Response:', response.data)
    } catch (error: any) {
        console.error('Error triggering git pull:', error.message)
        if (error.response) {
            console.error('Status:', error.response.status)
            console.error('Data:', error.response.data)
        }
    }
}

triggerGitPull()
