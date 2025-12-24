import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/waha'

export async function POST(req: Request) {
    try {
        const { endpoint, session: sessionName, apiKey } = await getConfig()

        // Fix recursive call issue
        // Fix recursive call issue - REMOVED for production support
        // if (endpoint.includes(':3000')) {
        //     console.log('[Session Start] Detected potential recursive endpoint (3000), switching to 3001')
        //     endpoint = 'http://localhost:3001'
        // }

        // Use production URL for webhook if available, otherwise fallback to localhost
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3005'
        const webhookUrl = `${baseUrl}/api/webhooks/waha`
        const sessionConfig = {
            proxy: null,
            debug: false,
            webhooks: [
                {
                    url: webhookUrl,
                    events: ['message', 'message.any', 'state.change']
                }
            ]
        }

        console.log(`[Session Start] Ensuring session '${sessionName}' with webhook ${webhookUrl}`)

        // 1. Try to CREATE the session
        const createUrl = `${endpoint}/api/sessions`
        const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body: JSON.stringify({
                name: sessionName,
                config: sessionConfig,
                start: true
            })
        })

        if (createRes.ok) {
            console.log('[Session Start] Created new session')
            return NextResponse.json({ success: true, message: 'Session created and started' })
        }

        // 2. If 422 (Already exists), UPDATE it (PUT)
        if (createRes.status === 422) {
            console.log('[Session Start] Session exists, updating config (PUT)...')
            const updateUrl = `${endpoint}/api/sessions/${sessionName}`
            const updateRes = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': apiKey
                },
                body: JSON.stringify({
                    config: sessionConfig
                })
            })

            if (updateRes.ok) {
                console.log('[Session Start] Session updated. Now forcing START...')
                // Force START
                const startUrl = `${endpoint}/api/sessions/${sessionName}/start`
                await fetch(startUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Api-Key': apiKey
                    },
                    body: '{}'
                })

                console.log('[Session Start] Start signal sent')
                return NextResponse.json({ success: true, message: 'Session updated and restarted' })
            } else {
                const errorText = await updateRes.text()
                console.error(`[Session Start] Update Failed: ${errorText}`)
                return NextResponse.json({ error: `Update failed: ${errorText}` }, { status: updateRes.status })
            }
        }

        const errorText = await createRes.text()
        console.error(`[Session Start] Creation Failed: ${createRes.status} - ${errorText}`)
        return NextResponse.json({ error: errorText }, { status: createRes.status })

    } catch (error: any) {
        console.error('[Session Start] Exception:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
