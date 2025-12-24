import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/waha'

export async function POST(req: Request) {
    try {
        const { endpoint, session: sessionName, apiKey } = await getConfig()

        const url = `${endpoint}/api/sessions/${sessionName}/start`
        console.log(`[WAHA Start] Attempting to start session: ${url}`)

        // 1. Try to start the specific session
        let res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body: JSON.stringify({})
        })

        if (res.ok) {
            console.log('[WAHA Start] Success')
            return NextResponse.json({ success: true, message: 'Session start requested' })
        }

        const errorText = await res.text()

        // Handle "Session already exists" or "already started" as success
        if (res.status === 422 && (errorText.includes('already exists') || errorText.includes('already started'))) {
            console.log('[WAHA Start] Session already exists/started, treating as success')
            return NextResponse.json({ success: true, message: 'Session already running' })
        }

        console.error(`[WAHA Start] Failed: ${res.status} - ${errorText}`)

        // 2. If 404, maybe session doesn't exist? Try to create it.
        if (res.status === 404) {
            console.log('[WAHA Start] 404, attempting to create session...')
            res = await fetch(`${endpoint}/api/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': apiKey
                },
                body: JSON.stringify({
                    name: sessionName,
                    config: {
                        proxy: null,
                        debug: false
                    }
                })
            })

            if (res.ok) {
                console.log('[WAHA Start] Creation Success')
                return NextResponse.json({ success: true, message: 'Session created and started' })
            }
            const createError = await res.text()
            console.error(`[WAHA Start] Creation Failed: ${createError}`)
        }

        return NextResponse.json({ error: errorText }, { status: res.status })

    } catch (error: any) {
        console.error('[WAHA Start] Exception:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
