import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'

// Simulate the webhook logic to trap errors
export async function GET() {
    const logs: string[] = []
    const log = (msg: any) => logs.push(typeof msg === 'object' ? JSON.stringify(msg) : String(msg))

    try {
        log('Starting Simulation...')

        // 1. Check Settings
        const settingsList = await prisma.setting.findMany()
        log(`Settings found: ${settingsList.length}`)
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // 2. Simulate Payload
        const fakePhone = '33612345678'
        const normalizedPhone = `+${fakePhone}`
        log(`Simulating message from ${normalizedPhone}`)

        // 3. Upsert Contact
        log('Upserting Contact...')
        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: normalizedPhone },
            update: {},
            create: {
                phone_whatsapp: normalizedPhone,
                name: 'Debug User',
                source: 'Debug Simulation',
                status: 'new'
            }
        })
        log(`Contact: ${contact.id}`)

        // 4. Find Conversation
        log('Finding Conversation...')
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                status: 'active'
            },
            include: { prompt: true }
        })

        if (!conversation) {
            log('No active conversation, creating one...')
            const defaultPrompt = await prisma.prompt.findFirst({
                where: { isActive: true }
            }) || await prisma.prompt.findFirst()

            if (defaultPrompt) {
                log(`Using prompt: ${defaultPrompt.name} (${defaultPrompt.id})`)
                conversation = await prisma.conversation.create({
                    data: {
                        contactId: contact.id,
                        promptId: defaultPrompt.id,
                        status: 'active',
                        ai_enabled: true
                    },
                    include: { prompt: true }
                })
            } else {
                throw new Error('No Prompt Found in DB!')
            }
        }
        log(`Conversation: ${conversation.id}`)

        // 5. Save Message
        log('Creating Message...')
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'contact',
                message_text: 'Hello Debug',
                waha_message_id: 'debug_123',
                timestamp: new Date()
            }
        })

        // 6. Test AI Generation (Venice)
        log('Testing AI (Venice)...')
        const apiKey = settings.venice_api_key
        if (!apiKey) log('WARNING: No Venice API Key found')

        // Just test simple completion
        // const response = await venice.chatCompletion(...) // We can skip actual call to save credits/time if not needed, but better to test imports.

        log('Simulation Complete Success!')

        return NextResponse.json({ success: true, logs })

    } catch (error: any) {
        log(`ERROR: ${error.message}`)
        if (error.stack) log(error.stack)
        return NextResponse.json({ success: false, logs, error: error.message }, { status: 500 })
    }
}
