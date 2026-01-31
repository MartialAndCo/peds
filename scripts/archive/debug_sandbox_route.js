const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Mock classes
const venice = { chatCompletion: async () => "Simulated AI Response" }
const anthropic = { chatCompletion: async () => "Simulated AI Response" }

// Mock libraries
const mediaService = {
    analyzeRequest: async (text) => ({ isMediaRequest: false, allowed: true }),
    processRequest: async () => ({ action: 'NONE' })
}
const memoryService = {
    search: async () => [],
    add: async () => { }
}

// Real Director Import (via require since we are in node script)
// We need to use relative path for script
const { director } = require('../lib/director')
const { prisma: prismaLib } = require('../lib/prisma') // Mock or use real? We have new PrismaClient() at top.

// Mock Settings for Director
const settings = {
    prompt_identity_template: "Role: {{ROLE}}",
    prompt_context_template: "Context: {{USER_NAME}}",
    prompt_mission_template: "Mission: {{DYNAMIC_GOAL_BLOCK}}",
    phase_prompt_connection: "Be nice.",
    phase_prompt_vulnerability: "Be sad.",
    phase_prompt_crisis: "Be mad.",
    ai_provider: 'venice'
}

const SANDBOX_PHONE = 'SANDBOX_CLIENT'

async function debugSandbox() {
    console.log('--- STARTING SANDBOX DEBUG ---')
    try {
        const message = "Hello friend"

        // 1. Setup Sandbox Contact
        console.log('1. Contact Upsert...')
        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: SANDBOX_PHONE },
            update: {},
            create: {
                phone_whatsapp: SANDBOX_PHONE,
                name: "Sandbox User",
                source: "Sandbox",
                status: 'sandbox'
                // Removed email, ensuring schema compliance
            }
        })
        console.log('   Contact OK:', contact.id)

        // 2. Find/Create Conversation
        console.log('2. Conversation Find...')
        let conversation = await prisma.conversation.findFirst({
            where: { contactId: contact.id, status: 'active' },
            include: { prompt: true }
        })

        if (!conversation) {
            console.log('   Creating Conversation...')
            const defaultPrompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
            if (!defaultPrompt) throw new Error('No prompt configured')

            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    promptId: defaultPrompt.id,
                    status: 'active',
                    ai_enabled: true
                },
                include: { prompt: true }
            })
        }
        console.log('   Conversation OK:', conversation.id)

        // 3. Save User Message
        console.log('3. Save Message...')
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'contact',
                message_text: message,
                timestamp: new Date()
            }
        })
        console.log('   Message Saved.')

        // 4. Logic simulation (using REAL Director)
        console.log('4. AI Logic (Director Check)...')

        // Trust
        await director.updateTrustScore(contact.phone_whatsapp, message)

        // Phase
        const { phase, details } = await director.determinePhase(contact.phone_whatsapp)
        console.log('   Phase:', phase)

        // Template
        const systemPrompt = director.buildSystemPrompt(
            settings,
            contact,
            phase,
            details,
            conversation.prompt.system_prompt
        )
        console.log('   Generated Prompt Length:', systemPrompt.length)
        console.log('   Prompt Preview:', systemPrompt.substring(0, 100).replace(/\n/g, ' '))

        console.log('--- SUCCESS ---')

    } catch (error) {
        console.error('!!! ERROR !!!')
        console.error(error)
    } finally {
        await prisma.$disconnect()
    }
}

debugSandbox()
