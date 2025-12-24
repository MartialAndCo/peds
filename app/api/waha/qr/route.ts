import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        let endpoint = settings.waha_endpoint || process.env.WAHA_ENDPOINT || 'http://localhost:3001'
        // FIX: Removed localhost override for port 3000
        // if (endpoint.includes(':3000')) endpoint = 'http://localhost:3001'

        const sessionName = settings.waha_session || process.env.WAHA_SESSION || 'default'

        const imageUrl = `${endpoint}/api/${sessionName}/auth/qr?format=image`

        const res = await fetch(imageUrl, {
            headers: {
                'X-Api-Key': settings.waha_api_key || process.env.WAHA_API_KEY || 'secret'
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
