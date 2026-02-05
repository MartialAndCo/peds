import { prisma } from '@/lib/prisma'

async function emergencyCheck() {
    console.log('🚨 EMERGENCY CHECK 🚨\n')
    
    try {
        // 1. Check agents
        const agents = await prisma.agent.findMany()
        console.log(`Found ${agents.length} agents:`)
        agents.forEach(a => console.log(`  - ${a.name} (${a.id})`))
        
        // 2. Check agentProfiles
        console.log('\n--- AgentProfiles ---')
        for (const agent of agents) {
            const profile = await prisma.agentProfile.findUnique({
                where: { agentId: agent.id }
            })
            if (profile) {
                console.log(`${agent.name}:`)
                console.log(`  identityTemplate: ${profile.identityTemplate ? '✅ (' + profile.identityTemplate.substring(0, 50) + '...)' : '❌ NULL'}`)
                console.log(`  contextTemplate: ${profile.contextTemplate ? '✅' : '❌ NULL'}`)
                console.log(`  styleRules: ${profile.styleRules ? '✅ (' + profile.styleRules.length + ' chars)' : '❌ NULL'}`)
                console.log(`  missionTemplate: ${profile.missionTemplate ? '✅' : '❌ NULL'}`)
            } else {
                console.log(`${agent.name}: ❌ NO PROFILE`)
            }
        }
        
        // 3. Check prompts
        console.log('\n--- Prompts ---')
        const prompts = await prisma.prompt.findMany()
        console.log(`Found ${prompts.length} prompts`)
        prompts.forEach(p => {
            console.log(`  - ${p.name} (ID: ${p.id}, Active: ${p.isActive})`)
            if (p.system_prompt) {
                console.log(`    Content: ${p.system_prompt.substring(0, 100)}...`)
            } else {
                console.log(`    Content: ❌ EMPTY`)
            }
        })
        
        // 4. Check agentPrompts
        console.log('\n--- AgentPrompts ---')
        const agentPrompts = await prisma.agentPrompt.findMany()
        console.log(`Found ${agentPrompts.length} agentPrompts`)
        
        // 5. Check AI_MODE setting
        console.log('\n--- AI Mode ---')
        const aiModeSetting = await prisma.setting.findUnique({
            where: { key: 'ai_mode' }
        })
        console.log(`AI_MODE: ${aiModeSetting?.value || 'NOT SET (default: CLASSIC)'}`)
        
    } catch (error) {
        console.error('ERROR:', error)
    } finally {
        await prisma.$disconnect()
    }
}

emergencyCheck()
