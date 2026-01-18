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
    async handleProviderMessage(providerPhone: string, text: string, messageId: string, agentId?: number) {
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
            // Even if existing, we might want to ensure 'WAITING_FOR_LEAD' if it was idle?
            // User didn't specify behavior for existing convs, but "updating notes" implies we just add info.
            // If it's already active, we shouldn't pause it.
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
