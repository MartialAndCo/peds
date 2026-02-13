import { prisma } from '../lib/prisma'

async function detailedCheck() {
    // Récupérer les IDs des agents
    const lena = await prisma.agent.findFirst({ where: { name: { contains: 'Lena', mode: 'insensitive' } } })
    const anais = await prisma.agent.findFirst({ where: { name: { contains: 'Anaïs', mode: 'insensitive' } } })
    
    console.log('Lena ID:', lena?.id)
    console.log('Anaïs ID:', anais?.id)
    console.log('')

    // Vérifier les contacts qui ont le même nom que des leads Discord
    const discordLeads = await prisma.lead.findMany({
        where: { type: 'DISCORD' },
        include: { contact: true }
    })

    console.log('=== CONTACTS DISCORD (leads) ===\n')
    for (const lead of discordLeads) {
        console.log(`${lead.identifier}:`)
        console.log(`  Contact ID: ${lead.contact?.id}`)
        console.log(`  Contact phone_whatsapp: ${lead.contact?.phone_whatsapp || 'null'}`)
        console.log(`  Contact discordId: ${lead.contact?.discordId || 'null'}`)
        console.log(`  Lead agentId: ${lead.agentId}`)
        console.log(`  Contact agentPhase: ${lead.contact?.agentPhase}`)
        
        // Vérifier si ce contact a aussi un AgentContact chez Anaïs
        if (lead.contact && anais) {
            const anaisLink = await prisma.agentContact.findFirst({
                where: { contactId: lead.contact.id, agentId: anais.id }
            })
            if (anaisLink) {
                console.log(`  ⚠️ Aussi lié à Anaïs!`)
            } else {
                console.log(`  ✓ Pas chez Anaïs`)
            }
        }
        console.log('')
    }

    // Vérifier tous les contacts chez Anaïs avec plus de détails
    console.log('\n=== TOUS LES CONTACTS CHEZ ANAÏS ===\n')
    
    if (anais) {
        const allAnaisContacts = await prisma.agentContact.findMany({
            where: { agentId: anais.id },
            include: { 
                contact: {
                    include: { lead: true }
                }
            }
        })
        
        for (const ac of allAnaisContacts) {
            console.log(`Contact: ${ac.contact.name || 'Sans nom'}`)
            console.log(`  ID: ${ac.contact.id}`)
            console.log(`  Phone: ${ac.contact.phone_whatsapp || 'null'}`)
            console.log(`  DiscordId: ${ac.contact.discordId || 'null'}`)
            console.log(`  Source: ${ac.contact.source}`)
            console.log(`  Lead associé: ${ac.contact.lead ? ac.contact.lead.identifier + ' (' + ac.contact.lead.type + ')' : 'AUCUN'}`)
            console.log('')
        }
    }
}

detailedCheck()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
