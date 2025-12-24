const { PrismaClient } = require('@prisma/client')
const axios = require('axios')
const prisma = new PrismaClient()

// Message ID and Chat ID from User Logs
const MESSAGE_ID = 'false_33695472237@c.us_3EB0017F41EAA5538FA50D'
const CHAT_ID = '33695472237@c.us'

async function debugMediaDownload() {
    console.log('--- Debugging Media Download ---')

    try {
        // 1. Get Settings
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        const endpoint = settings.waha_endpoint || 'http://localhost:3001'
        const session = settings.waha_session || 'default'
        const apiKey = settings.waha_api_key || 'secret'

        console.log(`Config: Endpoint=${endpoint}, Session=${session}`)

        // 2. Fetch Message Details
        const encodedChatId = encodeURIComponent(CHAT_ID)
        const encodedMsgId = encodeURIComponent(MESSAGE_ID)
        const messageUrl = `${endpoint}/api/${session}/chats/${encodedChatId}/messages/${encodedMsgId}`

        console.log(`fetching details from: ${messageUrl}`)

        const msgResponse = await axios.get(messageUrl, {
            headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' }
        })

        const mediaUrl = msgResponse.data?.media?.url
        console.log('Raw mediaUrl from WAHA:', mediaUrl)

        if (!mediaUrl) {
            console.error('ERROR: No media.url found in response')
            return
        }

        // 3. Apply Rewrite Logic (Same as lib/waha.ts)
        let finalUrl = mediaUrl
        if (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1')) {
            try {
                const mediaUrlObj = new URL(mediaUrl)
                const endpointObj = new URL(endpoint)

                mediaUrlObj.protocol = endpointObj.protocol
                mediaUrlObj.host = endpointObj.host
                mediaUrlObj.port = endpointObj.port

                finalUrl = mediaUrlObj.toString()
                console.log(`Rewrote local URL to: ${finalUrl}`)
            } catch (e) {
                console.warn('Rewrite failed:', e.message)
            }
        } else if (mediaUrl.startsWith('/')) {
            finalUrl = `${endpoint}${mediaUrl}`
            console.log(`Rewrote relative URL to: ${finalUrl}`)
        }

        // 4. Attempt Download
        console.log(`Attempting download from: ${finalUrl}`)
        const downloadRes = await axios.get(finalUrl, {
            headers: { 'X-Api-Key': apiKey },
            responseType: 'arraybuffer'
        })

        console.log('Download Status:', downloadRes.status)
        console.log('Content-Type:', downloadRes.headers['content-type'])
        console.log('Data Length:', downloadRes.data.length)
        console.log('SUCCESS: Media downloaded successfully.')

    } catch (error) {
        console.error('FAILURE:', error.message)
        if (error.response) {
            console.error('Status:', error.response.status)
            console.error('Data:', error.response.data?.toString())
        }
    } finally {
        await prisma.$disconnect()
    }
}

debugMediaDownload()
