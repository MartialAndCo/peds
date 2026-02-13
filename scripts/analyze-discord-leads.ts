import { prisma } from '../lib/prisma'

async function analyzeDiscordLeads() {
    console.log('=== ANALYSE DES LEADS DISCORD ===\n')

    // 1. Récupérer l'agent Discord configuré
    const discordAgentSetting = await prisma.setting.findUnique({
        where: { key: 'discord_agent_id' }
    })
    console.log('Agent Discord configuré:', discordAgentSetting?.value || 'NON CONFIGURÉ')

    // 2. Trouver tous les leads Discord
    const discordLeads = await prisma.lead.findMany({
        where: { type: 'DISCORD' },
        include: {
            agent: { select: { id: true, name: true } },
            contact: {
                include: {
                    conversations: {
                        include: { agent: { select: { id: true, name: true } } }
                    },
                    agentContacts: {
                        include: { agent: { select: { id: true, name: true } } }
                    }
                }
            }
        }
    })

    console.log(`\nNombre total de leads Discord: ${discordLeads.length}`)
    console.log('\n--- DÉTAILS PAR LEAD ---\n')

    for (const lead of discordLeads) {
        console.log(`Lead: ${lead.identifier}`)
        console.log(`  Lead.agentId: ${lead.agentId} (${lead.agent.name})`)
        console.log(`  Lead.status: ${lead.status}`)
        
        if (lead.contact) {
            console.log(`  Contact.id: ${lead.contact.id}`)
            console.log(`  Contact.name: ${lead.contact.name}`)
            console.log(`  Contact.status: ${lead.contact.status}`)
            
            // Vérifier les conversations
            for (const conv of lead.contact.conversations) {
                console.log(`  Conversation: ${conv.id}`)
                console.log(`    Conv.agentId: ${conv.agentId} (${conv.agent.name})`)
                console.log(`    Conv.status: ${conv.status}`)
            }
            
            // Vérifier les AgentContacts
            console.log(`  AgentContacts (${lead.contact.agentContacts.length}):`)
            for (const ac of lead.contact.agentContacts) {
                console.log(`    - ${ac.agentId} (${ac.agent.name})`)
            }
        } else {
            console.log('  Pas de contact associé')
        }
        
        // Vérifier si c'est correctement configuré
        const isCorrect = lead.agentId === discordAgentSetting?.value
        console.log(`  ✓ Correct: ${isCorrect ? 'OUI' : 'NON - Devrait être ${discordAgentSetting?.value}'}`)
        console.log('')
    }

    // 3. Statistiques
    const correctLeads = discordLeads.filter(l => l.agentId === discordAgentSetting?.value)
    const incorrectLeads = discordLeads.filter(l => l.agentId !== discordAgentSetting?.value)
    
    console.log('=== STATISTIQUES ===')
    console.log(`Leads avec bon agent: ${correctLeads.length}`)
    console.log(`Leads avec mauvais agent: ${incorrectLeads.length}`)

    // 4. Vérifier les contacts orphelins (pas de lead mais liés à Anaïs)
    console.log('\n=== VÉRIFICATION DES CONTACTS ORPHELINS ===')
    
    // Trouver Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Anaïs', mode: 'insensitive' } }
    })
    
    if (anais) {
        console.log(`\nAgent Anaïs trouvé: ${anais.id}`)
        
        // Contacts liés à Anaïs avec un nom Discord (pas de numéro de téléphone)
        const anaisContacts = await prisma.contact.findMany({
            where: {
                agentContacts: {
                    some: { agentId: anais.id }
                },
                phone_whatsapp: null,  // Pas de numéro WhatsApp = probablement Discord
                lead: null  // Pas de lead associé
            },
            include: {
                agentContacts: { include: { agent: true } },
                conversations: { include: { agent: true } }
            }
        })
        
        console.log(`Contacts chez Anaïs sans lead (probablement Discord): ${anaisContacts.length}`)
        
        for (const contact of anaisContacts.slice(0, 10)) {
            console.log(`  - ${contact.name} (${contact.id})`)
        }
    }
}

analyzeDiscordLeads()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
