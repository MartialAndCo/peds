import { prisma } from '@/lib/prisma'

async function checkAll() {
    console.log('🔍 Checking ALL agents...\n')
    
    const agents = await prisma.agent.findMany()
    
    for (const agent of agents) {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`Agent: ${agent.name} (${agent.id})`)
        console.log('='.repeat(60))
        
        // Check profile
        const profile = await prisma.agentProfile.findUnique({
            where: { agentId: agent.id }
        })
        
        if (!profile) {
            console.log('❌ NO PROFILE - This agent WILL fail!')
            continue
        }
        
        // Check critical fields
        const critical = {
            identityTemplate: profile.identityTemplate?.length || 0,
            contextTemplate: profile.contextTemplate?.length || 0,
            styleRules: profile.styleRules?.length || 0,
            missionTemplate: profile.missionTemplate?.length || 0
        }
        
        console.log('Profile fields:')
        Object.entries(critical).forEach(([key, len]) => {
            const status = len > 0 ? '✅' : '❌ EMPTY'
            console.log(`  ${key}: ${status} (${len} chars)`)
        })
        
        // Check agentPrompts (for classic mode)
        const agentPrompts = await prisma.agentPrompt.findMany({
            where: { agentId: agent.id }
        })
        console.log(`AgentPrompts: ${agentPrompts.length}`)
        
        // Check conversations
        const convs = await prisma.conversation.count({
            where: { agentId: agent.id, status: 'active' }
        })
        console.log(`Active conversations: ${convs}`)
    }
}

checkAll().then(() => process.exit()).catch(console.error)
