import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'

export const leadService = {
    /**
     * Parse incoming text to extract Phone and Context.
     */
    parseLeadMessage(text: string) {
        // Strict parsing: Phone is the FIRST contiguous token. Everything after the first space is context.
        // This is based on user rule: "As soon as there is a space, it's no longer the number".

        const trimmedText = text.trim()
        if (!trimmedText) return { error: 'EMPTY_TEXT' }

        // Find the split point (first space)
        // Use a regex to find the first whitespace (including non-breaking space if any, though ' ' is usually enough)
        const match = trimmedText.match(/\s/)
        const firstSpaceIndex = match ? match.index : -1

        let rawPhone = ''
        let context = ''

        if (firstSpaceIndex === -1 || firstSpaceIndex === undefined) {
            rawPhone = trimmedText
            context = "No context provided."
        } else {
            rawPhone = trimmedText.substring(0, firstSpaceIndex)
            context = trimmedText.substring(firstSpaceIndex + 1).trim() || "No context provided."
        }

        // Clean: remove dots, dashes, parens (just in case)
        const cleanPhone = rawPhone.replace(/[\.\-\(\)]/g, '').replace(/^00/, '+')

        // Basic validation: must contain digits
        if (!/\d/.test(cleanPhone)) {
            return { error: 'NO_PHONE_FOUND' }
        }

        // Normalize 06/07 to +33 (default FR if no country code)
        let finalPhone = cleanPhone

        // Truncate logic still useful if multiple numbers are mistakenly attached, 
        // e.g. "061234567818" (forgot space). 
        // But user said "I put 18 ans" (space implied). 
        // Keeping it for safety.

        // Case 1: Starts with +33. Expected length 12 (+33 + 9 digits).
        if (finalPhone.startsWith('+33') && finalPhone.length > 12) {
            finalPhone = finalPhone.substring(0, 12)
        }
        // Case 2: Starts with 06/07. Expected length 10.
        else if ((finalPhone.startsWith('06') || finalPhone.startsWith('07')) && finalPhone.length > 10) {
            finalPhone = finalPhone.substring(0, 10)
        }

        if (finalPhone.startsWith('06') || finalPhone.startsWith('07')) {
            finalPhone = '+33' + finalPhone.substring(1)
        }

        return {
            phone: finalPhone,
            context: context
        }
    },

    /**
     * Handle message from the Lead Provider.
     */
    async handleProviderMessage(providerPhone: string, text: string, messageId: string, agentId?: string) {
        // Expecting: "Phone + Context"
        const parseResult = this.parseLeadMessage(text)

        if (parseResult.error || !parseResult.phone) {
            await whatsapp.sendText(providerPhone, "⚠️ I couldn't find a phone number. Please send: '0612345678 Context of the lead'.", undefined, agentId)
            return
        }

        // 1. Create/Get Target Contact
        const targetPhone = parseResult.phone as string
        const context = parseResult.context as string

        let targetContact = await prisma.contact.findUnique({ where: { phone_whatsapp: targetPhone } })

        if (!targetContact) {
            targetContact = await prisma.contact.create({
                data: {
                    phone_whatsapp: targetPhone,
                    name: 'Inconnu',
                    source: 'lead_provider',
                    notes: `Context: ${context}`,
                    status: 'new'
                }
            })
        } else {
            // Append context to notes
            await prisma.contact.update({
                where: { id: targetContact.id },
                data: { notes: (targetContact.notes || '') + `\n[Lead Update]: ${context}` }
            })
        }

        // 2. Create Target Conversation (PAUSED / WAITING)
        // Check if there is already an active conversation
        const existingConv = await prisma.conversation.findFirst({
            where: {
                contactId: targetContact.id,
                status: { in: ['active', 'paused'] }
            }
        })

        if (!existingConv) {
            const prompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
            if (!prompt) return

            await prisma.conversation.create({
                data: {
                    contactId: targetContact.id,
                    promptId: prompt.id,
                    agentId: agentId, // Bind to agent
                    status: 'paused', // Start PAUSED
                    ai_enabled: true,
                    metadata: {
                        state: 'WAITING_FOR_LEAD', // Magic flag
                        leadContext: context
                    }
                }
            })
        } else {
            // FIX: If conversation exists but is PAUSED (e.g. user messaged before lead provider),
            // we MUST enable the 'WAITING_FOR_LEAD' state so the next message wakes it up.
            // Or if we want to be even smarter: if it's paused, it means the user is waiting.

            if (existingConv.status === 'paused') {
                const currentMeta = (existingConv.metadata as any) || {}
                // Only update if not already in that state (to avoid unnecessary writes, though harmless)
                await prisma.conversation.update({
                    where: { id: existingConv.id },
                    data: {
                        metadata: {
                            ...currentMeta,
                            state: 'WAITING_FOR_LEAD',
                            leadContext: context
                        }
                    }
                })
            }
        }

        // 3. Acknowledge with Reaction
        try {
            await whatsapp.sendReaction(providerPhone, messageId, '👍', agentId)
        } catch (e) {
            console.error('[LeadService] Failed to send reaction', e)
            // Fallback to text if reaction fails? Nah, keep it clean.
        }
    }
}
