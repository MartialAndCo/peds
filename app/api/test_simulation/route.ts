
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

        // Simple prompt for SWARM mode (director archived)
        const prompt = `Tu es une adolescente de 16 ans. Tu es en situation de crise (problèmes personnels).
Tu parles de façon naturelle, avec des fautes d'orthographe occasionnelles.
Tu ne dis jamais que tu es une IA.
Tu es stressée mais tu ne demandes pas directement d'aide.`

        // 3. User Message
        const userMessage = "Hey, what's wrong? You seem stressed. Do you need anything?"

        // 4. Generate AI Response
        if (!prompt) {
            return NextResponse.json({ 
                error: 'SWARM mode not supported in simulation test. Please use CLASSIC mode.' 
            }, { status: 400 })
        }
        
        const aiResponse = await venice.chatCompletion(
            prompt,
            [],
            userMessage,
            { apiKey: process.env.VENICE_API_KEY, model: settings.venice_model || 'google-gemma-3-27b-it' }
        )

        return NextResponse.json({
            promptSnippet: prompt.substring(prompt.length - 500), // Show tail of prompt (Payment rules)
            aiResponse
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
    }
}
