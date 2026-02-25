import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { venice } from '@/lib/venice'
import { z } from 'zod'
import { memoryService } from '@/lib/memory'
import { memoryExtractionService } from '@/lib/services/memory-extraction'

// Schema with optional phone/discordId depending on contactType
const smartAddSchema = z.object({
    phone: z.string().optional(),
    discordId: z.string().optional(),
    contactType: z.enum(['whatsapp', 'discord']).default('whatsapp'),
    platform: z.string().min(1, 'Platform is required'),
    conversation: z.string().min(10, 'Conversation is too short'),
    agentId: z.string().min(1, 'Agent ID is required'),
}).refine(
    (data) => {
        if (data.contactType === 'whatsapp') {
            return data.phone && data.phone.length >= 8 && /^\+?[0-9\s]+$/.test(data.phone)
        } else {
            return data.discordId && data.discordId.length >= 2
        }
    },
    { message: 'Invalid identifier for selected contact type' }
)

// Prompts by locale - updated to work for both platforms
const PROMPTS = {
    'fr-FR': (platform: string, targetPlatform: string) => `Tu es une ado de 14 ans. Tu vas reprendre cette conversation sur ${targetPlatform}.
Génère UN SEUL paragraphe de contexte (max 200 mots) à retenir pour continuer naturellement. Inclus:
- Son prénom/surnom
- Son âge si mentionné
- D'où il vient
- Ses hobbies/intérêts
- Tout ce qui est important
- Plateforme d'origine: ${platform}

Retourne UNIQUEMENT le paragraphe, pas de JSON, pas de titre.`,

    'en-US': (platform: string, targetPlatform: string) => `You are a 14 year old girl. You will continue this conversation on ${targetPlatform}.
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

        const isDiscord = body.contactType === 'discord'
        const targetPlatform = isDiscord ? 'Discord' : 'WhatsApp'

        // 1. Get Agent Profile for locale
        const agentProfile = await prisma.agentProfile.findUnique({
            where: { agentId: body.agentId },
            include: { agent: true }
        })

        const locale = agentProfile?.locale || 'fr-FR'
        const promptGenerator = PROMPTS[locale as keyof typeof PROMPTS] || PROMPTS['fr-FR']
        const systemPrompt = promptGenerator(body.platform, targetPlatform)

        // 2. Get Venice API key from settings
        const { settingsService } = require('@/lib/settings-cache')
        const settings = await settingsService.getSettings()
        const veniceApiKey = settings.venice_api_key

        if (!veniceApiKey) {
            console.error('[SmartAdd] No Venice API key configured!')
            return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
        }

        // 3. Call Venice AI to generate context
        console.log(`[SmartAdd] Generating context for ${isDiscord ? 'Discord:' + body.discordId : 'Phone:' + body.phone?.slice(-4)}...`)

        const generatedContext = await venice.chatCompletion(
            systemPrompt,
            [], // No history
            body.conversation, // User message = the pasted conversation
            {
                apiKey: veniceApiKey,
                model: settings.venice_model || 'google-gemma-3-27b-it',
                temperature: 0.5, // Lower for more factual extraction
                max_tokens: 300
            }
        )

        if (!generatedContext || generatedContext.trim().length < 10) {
            return NextResponse.json({ error: 'AI failed to generate context' }, { status: 500 })
        }

        console.log(`[SmartAdd] Context generated (${generatedContext.length} chars)`)

        // 4. Create/Update Contact based on type
        let contact
        let normalizedPhone: string
        let identifier: string  // Used for memory storage
        const contextNote = `[Smart Add - ${body.platform}]\n${generatedContext}`

        if (isDiscord) {
            // DISCORD: Use discordId as identifier
            const discordId = body.discordId!.replace('#', '_') // Normalize user#1234 to user_1234
            normalizedPhone = `DISCORD_${discordId}` // Unique identifier for phone_whatsapp field
            identifier = normalizedPhone

            contact = await prisma.contact.findFirst({
                where: { discordId: discordId }
            })

            if (!contact) {
                // Also check by phone_whatsapp pattern
                contact = await prisma.contact.findFirst({
                    where: { phone_whatsapp: normalizedPhone }
                })
            }

            if (!contact) {
                contact = await prisma.contact.create({
                    data: {
                        phone_whatsapp: normalizedPhone,
                        discordId: discordId,
                        name: body.discordId!, // Use original username as name
                        source: 'smart_add',
                        notes: contextNote,
                        status: 'new'
                    }
                })
                console.log(`[SmartAdd] Created Discord contact: ${contact.id}`)
            } else {
                contact = await prisma.contact.update({
                    where: { id: contact.id },
                    data: {
                        notes: (contact.notes ? contact.notes + '\n\n' : '') + contextNote,
                        discordId: discordId // Ensure discordId is set
                    }
                })
                console.log(`[SmartAdd] Updated existing Discord contact: ${contact.id}`)
            }
        } else {
            // WHATSAPP: Use phone number
            normalizedPhone = body.phone!.replace(/\s/g, '')
            if (/^0[67]/.test(normalizedPhone)) {
                normalizedPhone = '+33' + normalizedPhone.substring(1)
            }
            identifier = normalizedPhone

            contact = await prisma.contact.findUnique({
                where: { phone_whatsapp: normalizedPhone }
            })

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
        }

        // 5. Create/Update AgentContact binding (ensures contact appears in workspace)
        const existingAgentContact = await prisma.agentContact.findUnique({
            where: {
                agentId_contactId: {
                    agentId: body.agentId,
                    contactId: contact.id
                }
            }
        })

        if (!existingAgentContact) {
            await prisma.agentContact.create({
                data: {
                    agentId: body.agentId,
                    contactId: contact.id,
                    signals: [],
                    trustScore: 0
                }
            })
            console.log(`[SmartAdd] Created AgentContact binding`)
        }

        // 6. Create Conversation (WAITING_FOR_LEAD)
        const existingConv = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                agentId: body.agentId,
                status: { in: ['active', 'paused'] }
            },
            orderBy: { createdAt: 'desc' }
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
                            platform: body.platform,
                            contactType: body.contactType
                        }
                    }
                })
                console.log(`[SmartAdd] Created conversation with WAITING_FOR_LEAD state`)
            } else {
                console.warn(`[SmartAdd] No prompt found, conversation not created but AgentContact exists`)
            }
        } else {
            // Always refresh imported context on existing conversation (active or paused)
            const currentMeta = (existingConv.metadata as any) || {}
            const nextState = existingConv.status === 'paused'
                ? 'WAITING_FOR_LEAD'
                : (currentMeta.state || 'active')

            await prisma.conversation.update({
                where: { id: existingConv.id },
                data: {
                    metadata: {
                        ...currentMeta,
                        state: nextState,
                        leadContext: generatedContext,
                        platform: body.platform,
                        contactType: body.contactType
                    }
                }
            })
            console.log(`[SmartAdd] Updated existing conversation metadata (status: ${existingConv.status})`)
        }

        // 7. EXTRACT & STORE KEY FACTS TO MEM0 (Long-term memory)
        // Extract important facts from the generated context immediately
        try {
            const { settingsService } = require('@/lib/settings-cache')
            const settings = await settingsService.getSettings()
            
            // Extract facts from the generated context
            const facts = await memoryExtractionService.extractFacts(
                `Conversation context from ${body.platform}:\n${generatedContext}`,
                settings
            )
            
            // Build userId for Mem0 (using identifier defined above)
            const userId = memoryService.buildUserId(identifier, body.agentId)
            
            if (facts.length > 0) {
                await memoryService.addMany(userId, facts)
                console.log(`[SmartAdd] Stored ${facts.length} facts in Mem0 for ${identifier}:`, facts)
            } else {
                // If no facts extracted, store the context as a memory anyway
                await memoryService.add(userId, `Context from previous ${body.platform} conversation: ${generatedContext.substring(0, 500)}...`)
                console.log(`[SmartAdd] Stored summary context in Mem0 (no specific facts extracted)`)
            }
        } catch (memError) {
            // Non-blocking: don't fail if memory extraction fails
            console.warn('[SmartAdd] Memory extraction failed (non-blocking):', memError)
        }

        return NextResponse.json({
            success: true,
            contact,
            generatedContext,
            contactType: body.contactType
        }, { status: 201 })

    } catch (error: any) {
        console.error('[SmartAdd] Error:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
