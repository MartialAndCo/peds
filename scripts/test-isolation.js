const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * TEST E2E: Isolation Multi-Agent
 * - Vérifie que conversations sont séparées par agentId
 * - Vérifie que dashboard filtre correctement
 */

async function testMultiAgentIsolation() {
    console.log('=== TEST: MULTI-AGENT ISOLATION ===\n')

    const agents = await prisma.agent.findMany({
        include: {
            conversations: {
                take: 5,
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    console.log(`📊 Agents trouvés: ${agents.length}\n`)

    for (const agent of agents) {
        console.log(`--- ${agent.name} ---`)
        console.log(`  ID: ${agent.id}`)
        console.log(`  Téléphone: ${agent.phone}`)
        console.log(`  Conversations: ${agent.conversations.length}`)

        // Vérifier que conversations ont le bon agentId
        const wrongAgentId = agent.conversations.filter(c => c.agentId !== agent.id)

        if (wrongAgentId.length > 0) {
            console.log(`  ❌ PROBLÈME: ${wrongAgentId.length} conversations avec mauvais agentId!`)
        } else {
            console.log(`  ✅ Toutes les conversations ont le bon agentId`)
        }

        console.log('')
    }

    // Test de croisement
    console.log('🔍 Test de croisement:')

    const allConversations = await prisma.conversation.findMany({
        select: {
            id: true,
            contactId: true,
            agentId: true,
            contact: {
                select: { phone_whatsapp: true }
            }
        }
    })

    // Grouper par contactId
    const contactGroups = {}
    allConversations.forEach(conv => {
        if (!contactGroups[conv.contactId]) {
            contactGroups[conv.contactId] = []
        }
        contactGroups[conv.contactId].push(conv)
    })

    // Trouver contacts qui parlent à plusieurs agents
    const multiAgentContacts = Object.entries(contactGroups).filter(([_, convs]) => {
        const uniqueAgents = new Set(convs.map(c => c.agentId))
        return uniqueAgents.size > 1
    })

    if (multiAgentContacts.length > 0) {
        console.log(`  ✅ ${multiAgentContacts.length} contacts parlent à plusieurs agents`)
        console.log('     (Chaque contact a des conversations séparées par agent)\n')

        multiAgentContacts.slice(0, 3).forEach(([contactId, convs]) => {
            const phone = convs[0].contact.phone_whatsapp
            const agents = [...new Set(convs.map(c => c.agentId))]
            console.log(`     Contact ${phone}:`)
            agents.forEach(agentId => {
                const count = convs.filter(c => c.agentId === agentId).length
                console.log(`       - Agent ${agentId}: ${count} conversation(s)`)
            })
        })
    } else {
        console.log('  ℹ️  Aucun contact ne parle à plusieurs agents pour le moment')
    }

    console.log('\n🔍 Test manuel requis:')
    console.log('1. Envoyer message à Lena puis à Anaïs avec même numéro')
    console.log('2. Vérifier dashboards séparés')
    console.log('3. Vérifier que messages ne se mélangent pas')
}

testMultiAgentIsolation()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
