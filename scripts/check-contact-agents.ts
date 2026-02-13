import { prisma } from '../lib/prisma'

async function checkContactAgents() {
    console.log('=== VÉRIFICATION DES CONTACTS AVEC MULTIPLE AGENTS ===\n')

    // Trouver les contacts qui ont plusieurs AgentContacts
    const contactsWithMultipleAgents = await prisma.contact.findMany({
        where: {
            agentContacts: {
                some: {}
            }
        },
        include: {
            agentContacts: {
                include: { agent: true }
            },
            lead: true
        }
    })

    console.log(`Total contacts avec AgentContacts: ${contactsWithMultipleAgents.length}\n`)

    for (const contact of contactsWithMultipleAgents) {
        if (contact.agentContacts.length > 1) {
            console.log(`⚠️ CONTACT AVEC MULTIPLE AGENTS: ${contact.name || contact.id}`)
            console.log(`   Agents: ${contact.agentContacts.map(ac => ac.agent.name).join(', ')}`)
        }
    }

    // Vérifier spécifiquement les contacts des leads Discord
    console.log('\n=== CONTACTS DES LEADS DISCORD ===\n')
    
    const discordLeads = await prisma.lead.findMany({
        where: { type: 'DISCORD' },
        include: {
            contact: {
                include: {
                    agentContacts: { include: { agent: true } },
                    conversations: { include: { agent: true } }
                }
            }
        }
    })

    for (const lead of discordLeads) {
        if (lead.contact) {
            const agentNames = lead.contact.agentContacts.map(ac => ac.agent.name)
            console.log(`${lead.identifier}:`)
            console.log(`  AgentContacts: ${agentNames.join(', ') || 'AUCUN'}`)
            console.log(`  Conversations: ${lead.contact.conversations.length}`)
            for (const conv of lead.contact.conversations) {
                console.log(`    - Conv ${conv.id}: agent=${conv.agent.name}`)
            }
        }
    }

    // Vérifier si Anaïs a des contacts
    console.log('\n=== CONTACTS CHEZ ANAÏS ===\n')
    
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Anaïs', mode: 'insensitive' } }
    })
    
    if (anais) {
        const anaisContacts = await prisma.agentContact.findMany({
            where: { agentId: anais.id },
            include: { 
                contact: {
                    include: { lead: true }
                }
            }
        })
        
        console.log(`Anaïs a ${anaisContacts.length} contacts:\n`)
        
        for (const ac of anaisContacts) {
            const isDiscord = ac.contact.lead?.type === 'DISCORD'
            console.log(`  - ${ac.contact.name || ac.contact.id} ${isDiscord ? '(DISCORD!)' : '(WhatsApp)'}`)
            if (ac.contact.lead) {
                console.log(`    Lead: ${ac.contact.lead.identifier} -> Agent ${ac.contact.lead.agentId}`)
            }
        }
    }
}

checkContactAgents()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
