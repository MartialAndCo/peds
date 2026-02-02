import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { venice } from '@/lib/venice'
import { z } from 'zod'

const smartAddSchema = z.object({
    phone: z.string().min(8).regex(/^\+?[0-9\s]+$/, 'Invalid phone number'),
    platform: z.string().min(1, 'Platform is required'),
    conversation: z.string().min(10, 'Conversation is too short'),
    agentId: z.string().min(1, 'Agent ID is required'),
})

// Prompts by locale
const PROMPTS = {
    'fr-FR': (platform: string) => `Tu es une ado de 15 ans. Tu vas reprendre cette conversation sur WhatsApp.
Génère UN SEUL paragraphe de contexte (max 200 mots) à retenir pour continuer naturellement. Inclus:
- Son prénom/surnom
- Son âge si mentionné
- D'où il vient
- Ses hobbies/intérêts
- Tout ce qui est important
- Plateforme d'origine: ${platform}

Retourne UNIQUEMENT le paragraphe, pas de JSON, pas de titre.`,

    'en-US': (platform: string) => `You are a 15 year old girl. You will continue this conversation on WhatsApp.
Generate ONE paragraph of context (max 200 words) to remember for a seamless continuation. Include:
- Their name/nickname
- Their age if mentioned
- Where they're from
- Their hobbies/interests
- Anything important
- Original platform: ${platform}

Return ONLY the paragraph, no JSON, no headers.`
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const json = await req.json()
        const body = smartAddSchema.parse(json)

        // 1. Get Agent Profile for locale
        const agentProfile = await prisma.agentProfile.findUnique({
            where: { agentId: body.agentId },
            include: { agent: true }
        })

        const locale = agentProfile?.locale || 'fr-FR'
        const promptGenerator = PROMPTS[locale as keyof typeof PROMPTS] || PROMPTS['fr-FR']
        const systemPrompt = promptGenerator(body.platform)

        // 2. Call Venice AI to generate context
        console.log(`[SmartAdd] Generating context for phone ${body.phone.slice(-4)}...`)

        const generatedContext = await venice.chatCompletion(
            systemPrompt,
            [], // No history
            body.conversation, // User message = the pasted conversation
            {
                model: 'venice-uncensored',
                temperature: 0.5, // Lower for more factual extraction
                max_tokens: 300
            }
        )

        if (!generatedContext || generatedContext.trim().length < 10) {
            return NextResponse.json({ error: 'AI failed to generate context' }, { status: 500 })
        }

        console.log(`[SmartAdd] Context generated (${generatedContext.length} chars)`)

        // 3. Normalize phone
        let normalizedPhone = body.phone.replace(/\s/g, '')
        if (/^0[67]/.test(normalizedPhone)) {
            normalizedPhone = '+33' + normalizedPhone.substring(1)
        }

        // 4. Create/Update Contact
        let contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: normalizedPhone }
        })

        const contextNote = `[Smart Add - ${body.platform}]\n${generatedContext}`

        if (!contact) {
            contact = await prisma.contact.create({
                data: {
                    phone_whatsapp: normalizedPhone,
                    name: 'Inconnu', // AI might extract name, but we keep it simple for now
                    source: 'smart_add',
                    notes: contextNote,
                    status: 'new'
                }
            })
        } else {
            contact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    notes: (contact.notes ? contact.notes + '\n\n' : '') + contextNote
                }
            })
        }

        // 5. Create Conversation (WAITING_FOR_LEAD)
        const existingConv = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                agentId: body.agentId,
                status: { in: ['active', 'paused'] }
            }
        })

        if (!existingConv) {
            // Get prompt for this agent
            const agentPrompt = await prisma.agentPrompt.findFirst({
                where: { agentId: body.agentId, type: 'CORE' }
            })
            const promptId = agentPrompt?.promptId || (await prisma.prompt.findFirst({ where: { isActive: true } }))?.id

            if (promptId) {
                await prisma.conversation.create({
                    data: {
                        contactId: contact.id,
                        promptId: promptId,
                        agentId: body.agentId,
                        status: 'paused',
                        ai_enabled: true,
                        metadata: {
                            state: 'WAITING_FOR_LEAD',
                            leadContext: generatedContext,
                            platform: body.platform
                        }
                    }
                })
            }
        } else if (existingConv.status === 'paused') {
            // Update existing paused conversation
            await prisma.conversation.update({
                where: { id: existingConv.id },
                data: {
                    metadata: {
                        ...(existingConv.metadata as any || {}),
                        state: 'WAITING_FOR_LEAD',
                        leadContext: generatedContext,
                        platform: body.platform
                    }
                }
            })
        }

        return NextResponse.json({
            success: true,
            contact,
            generatedContext
        }, { status: 201 })

    } catch (error: any) {
        console.error('[SmartAdd] Error:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
