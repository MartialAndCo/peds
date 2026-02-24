import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import axios from 'axios'
const { director } = require('@/lib/director')


export const dynamic = 'force-dynamic'; // Prevent caching

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const conversationId = parseInt(id)
        const { context } = await req.json()

        console.log(`[Activate] Request for Conversation ID: ${conversationId}`)

        // Fetch Settings
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        const { activator } = require('@/lib/activator')
        const result = await activator.activateConversation(conversationId, context, settings)

        if (result.error) {
            throw new Error(result.error)
        }

        return NextResponse.json({ success: true, response: result.response })

    } catch (e: any) {
        console.error('Activation Error', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
