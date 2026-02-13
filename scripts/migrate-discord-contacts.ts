import { prisma } from '../lib/prisma'

async function migrateDiscordContacts() {
    console.log('=== MIGRATION DES CONTACTS DISCORD VERS LENA ===\n')

    // Récupérer Lena et Anaïs
    const lena = await prisma.agent.findFirst({
        where: { name: { contains: 'Lena', mode: 'insensitive' } }
    })
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Anaïs', mode: 'insensitive' } }
    })

    if (!lena || !anais) {
        console.log('Lena ou Anaïs non trouvé')
        return
    }

    console.log(`Lena: ${lena.id}`)
    console.log(`Anaïs: ${anais.id}\n`)

    // Trouver tous les contacts Discord chez Anaïs
    const discordContactsAtAnais = await prisma.contact.findMany({
        where: {
            agentContacts: {
                some: { agentId: anais.id }
            },
            OR: [
                { discordId: { not: null } },
                { phone_whatsapp: { startsWith: 'DISCORD_' } }
            ]
        },
        include: {
            agentContacts: true,
            conversations: true,
            lead: true
        }
    })

    console.log(`Contacts Discord trouvés chez Anaïs: ${discordContactsAtAnais.length}\n`)

    for (const contact of discordContactsAtAnais) {
        console.log(`Migration de: ${contact.name || contact.id}`)
        console.log(`  Phone: ${contact.phone_whatsapp}`)
        console.log(`  DiscordId: ${contact.discordId}`)
        console.log(`  Lead: ${contact.lead ? contact.lead.identifier : 'AUCUN'}`)

        try {
            await prisma.$transaction(async (tx) => {
                // 1. Supprimer l'ancien AgentContact (Anaïs)
                await tx.agentContact.deleteMany({
                    where: { contactId: contact.id }
                })

                // 2. Créer le nouvel AgentContact (Lena)
                await tx.agentContact.create({
                    data: {
                        agentId: lena.id,
                        contactId: contact.id,
                        phase: contact.agentPhase || 'CONNECTION'
                    }
                })

                // 3. Mettre à jour les conversations
                for (const conv of contact.conversations) {
                    await tx.conversation.update({
                        where: { id: conv.id },
                        data: { agentId: lena.id }
                    })
                }

                // 4. Mettre à jour le lead si existe
                if (contact.lead) {
                    await tx.lead.update({
                        where: { id: contact.lead.id },
                        data: { agentId: lena.id }
                    })
                }
            })

            console.log(`  ✓ Migré vers Lena\n`)
        } catch (error) {
            console.error(`  ✗ Erreur:`, error, '\n')
        }
    }

    console.log('=== TERMINÉ ===')
}

migrateDiscordContacts()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
