import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'

export const leadService = {
    /**
     * Parse incoming text to extract Phone and Context.
     */
    parseLeadMessage(text: string) {
        // Regex to find phone numbers (flexible: +33, 06, etc)
        // Handled: spaces, dots, dashes, non-breaking spaces
        const phoneRegex = /(?:\+|00)?(?:[0-9][\-\.\s(\)]?){6,14}[0-9]/g

        const phones = text.match(phoneRegex)

        if (!phones || phones.length === 0) {
            return { error: 'NO_PHONE_FOUND' }
        }

        // Assume the first one is the target
        const rawPhone = phones[0]
        // Clean: remove spaces, dots, dashes, parens
        const cleanPhone = rawPhone.replace(/[\s\.\-\(\)]/g, '').replace(/^00/, '+')

        // Normalize 06/07 to +33 (default FR if no country code)
        let finalPhone = cleanPhone
        if (cleanPhone.startsWith('06') || cleanPhone.startsWith('07')) {
            finalPhone = '+33' + cleanPhone.substring(1)
        }

        // Remove the phone from the text to get potential context
        // We replace only the first occurrence
        const context = text.replace(rawPhone, '').trim() || "No context provided."

        return {
            phone: finalPhone,
            context: context
        }
    },

    /**
     * Handle message from the Lead Provider.
     */
    async handleProviderMessage(providerPhone: string, text: string) {
        // 1. Get Provider's Conversation (to track state in metadata)
        let providerContact = await prisma.contact.findFirst({ where: { phone_whatsapp: providerPhone } })
        if (!providerContact) {
            providerContact = await prisma.contact.create({
                data: { phone_whatsapp: providerPhone, source: 'system_provider', status: 'active' } // Mark as active/system
            })
        }

        // Find conversation
        let conversation = await prisma.conversation.findFirst({
            where: { contactId: providerContact.id, status: 'active' },
            orderBy: { createdAt: 'desc' }
        })

        if (!conversation) {
            const prompt = await prisma.prompt.findFirst()
            if (!prompt) return;
            conversation = await prisma.conversation.create({
                data: { contactId: providerContact.id, promptId: prompt.id, status: 'active', metadata: { state: 'IDLE' } }
            })
        }

        const metadata = (conversation.metadata as any) || { state: 'IDLE' }
        const state = metadata.state || 'IDLE'

        console.log(`[LeadService] Provider State: ${state}`)

        // --- STATE MACHINE ---

        if (state === 'IDLE') {
            // Expecting: "Phone + Context"
            const parseResult = this.parseLeadMessage(text)

            if (parseResult.error) {
                await whatsapp.sendText(providerPhone, "⚠️ I couldn't find a phone number. Please send: '0612345678 Context of the lead'.")
                return
            }

            // Valid Parse -> Transition to CONFIRMING
            const { getLeadConfirmationMsg } = require('@/lib/spintax')
            const confirmMsg = getLeadConfirmationMsg(parseResult.phone, parseResult.context)

            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    metadata: {
                        state: 'CONFIRMING',
                        lastReminder: new Date(), // Initialize tracking
                        draft: {
                            phone: parseResult.phone,
                            context: parseResult.context
                        }
                    }
                }
            })

            await whatsapp.sendText(providerPhone, confirmMsg)
            return
        }

        if (state === 'CONFIRMING') {
            const cleanText = text.trim().toUpperCase()
            // Strict "OK" or "YES"
            const isConfirmed = cleanText === 'OK' || cleanText === 'YES'

            if (isConfirmed) {
                // ACTION: CREATE AND START
                const draft = metadata.draft

                // Using spin for this simple ACK too
                const { spin } = require('@/lib/spintax')
                await whatsapp.sendText(providerPhone, spin("{✅|🆗|👍} {Processing|Starting|Creating conctact}..."))

                // 1. Create/Get Target Contact
                const targetPhone = draft.phone
                let targetContact = await prisma.contact.findUnique({ where: { phone_whatsapp: targetPhone } })

                let isNew = false
                if (!targetContact) {
                    targetContact = await prisma.contact.create({
                        data: {
                            phone_whatsapp: targetPhone,
                            source: 'lead_provider',
                            notes: `Context: ${draft.context}`,
                            status: 'new'
                        }
                    })
                    isNew = true
                } else {
                    // Update notes?
                    await prisma.contact.update({
                        where: { id: targetContact.id },
                        data: { notes: (targetContact.notes || '') + `\n[Lead Update]: ${draft.context}` }
                    })
                }

                // 2. Create Target Conversation
                // Make sure we have a prompt
                const prompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
                if (!prompt) return

                const targetConv = await prisma.conversation.create({
                    data: {
                        contactId: targetContact.id,
                        promptId: prompt.id,
                        status: 'active', // START ACTIVE
                        ai_enabled: true
                    },
                    include: { prompt: true }
                })

                // 3. Generate Introduction
                // STANDARD: Use simple, natural openers instead of AI generation to avoid "weird" context failures.
                const { getLeadOpener, getLeadSuccessMsg } = require('@/lib/spintax')
                const firstMessage = getLeadOpener()

                /* AI Generation REMOVED for stability
                const systemPrompt = targetConv.prompt.system_prompt
                const genPrompt = `(SYSTEM: You are starting a conversation with a new person.
CONTEXT PROVIDED BY SOURCE: "${draft.context}".
INSTRUCTION: Write the first message to this person. Be natural, don't mention "the source" explicitly unless it makes sense. Just slide into their DMs effectively based on the context. Keep it short.)`
                
                // ... (Removed Venice Call) ...
                */

                // 4. Send to Target
                await whatsapp.sendText(targetPhone, firstMessage)

                // Save to DB
                await prisma.message.create({
                    data: {
                        conversationId: targetConv.id,
                        sender: 'ai',
                        message_text: firstMessage
                    }
                })

                // 5. Notify Provider + Stats
                // Count leads this month
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const count = await prisma.contact.count({
                    where: {
                        source: 'lead_provider',
                        createdAt: { gte: firstDay }
                    }
                })

                await whatsapp.sendText(providerPhone, getLeadSuccessMsg(firstMessage, count))

                // Reset Provider State
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { metadata: { state: 'IDLE' } }
                })

            } else {
                // Cancel
                const { getLeadCancelMsg } = require('@/lib/spintax')
                await whatsapp.sendText(providerPhone, getLeadCancelMsg())
                // Reset Provider State
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { metadata: { state: 'IDLE' } }
                })
            }
        }
    }
}
