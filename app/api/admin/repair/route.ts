'use server'

import { whatsapp } from '@/lib/whatsapp'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const sessionId = body.sessionId || '1'

        const result = await whatsapp.repairSession(sessionId)

        return Response.json(result)
    } catch (error: any) {
        console.error('Repair API Error:', error)
        return Response.json({
            success: false,
            message: error.message || 'Repair failed'
        }, { status: 500 })
    }
}
