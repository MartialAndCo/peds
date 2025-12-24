import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/waha'

export async function GET() {
    try {
        const { endpoint, session: sessionName, apiKey } = await getConfig()

        const imageUrl = `${endpoint}/api/${sessionName}/auth/qr?format=image`

        const res = await fetch(imageUrl, {
            headers: {
                'X-Api-Key': apiKey
            }
        })

        if (!res.ok) {
            return new NextResponse('Failed to fetch QR', { status: 404 })
        }

        // Use arrayBuffer directly as blob() can sometimes be problematic in Node envs depending on version
        const buffer = await res.arrayBuffer()

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            }
        })

    } catch (error: any) {
        console.error("QR Proxy Error:", error)
        return new NextResponse(error.message, { status: 500 })
    }
}
