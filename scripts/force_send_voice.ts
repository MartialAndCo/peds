
import { whatsapp, getConfig } from '../lib/whatsapp'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const TARGET_PHONE = '+33753777980'
const MEDIA_URL = process.argv[2] || 'http://13.60.16.81:3001/api/messages/3EB00FFA05AB0934F0493A/media?format=wav'

async function main() {
    const { apiKey } = await getConfig()
    console.log(`Downloading audio from ${MEDIA_URL} (Key Present: ${!!apiKey})...`)

    const response = await axios.get(MEDIA_URL, {
        responseType: 'arraybuffer',
        headers: { 'X-Api-Key': apiKey }
    })

    const buffer = Buffer.from(response.data)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:audio/wav;base64,${base64}`

    console.log(`Sending voice to ${TARGET_PHONE}...`)
    await whatsapp.sendVoice(TARGET_PHONE, dataUrl)
    console.log('✅ Sent!')
}

main().catch(console.error)
