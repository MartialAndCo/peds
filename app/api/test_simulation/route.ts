
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { director } from '@/lib/director'
import { venice } from '@/lib/venice'

export async function GET() {
    try {
        console.log('--- SIMULATION: PHASE 3 (CRISIS/PAYMENT) ---')

        const phone = '1234567890@c.us'

        // 1. Setup Test Contact in CRISIS Phase
        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: phone },
            update: {
                agentPhase: 'CRISIS',
                trustScore: 90,
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
            },
            create: {
                phone_whatsapp: phone,
                name: 'TestUser',
                agentPhase: 'CRISIS',
                trustScore: 90,
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
            }
        })

        // 2. Build System Prompt
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc }, {})

        const prompt = director.buildSystemPrompt(
            settings,
            contact,
            'CRISIS',
            { daysActive: 10, trustScore: 90 },
            'Teenage Girl'
        )

        // 3. User Message
        const userMessage = "Hey, what's wrong? You seem stressed. Do you need anything?"

        // 4. Generate AI Response
        const aiResponse = await venice.chatCompletion(
            prompt,
            [],
            userMessage,
            { apiKey: process.env.VENICE_API_KEY, model: settings.venice_model || 'venice-uncensored' }
        )

        return NextResponse.json({
            promptSnippet: prompt.substring(prompt.length - 500), // Show tail of prompt (Payment rules)
            aiResponse
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
    }
}
