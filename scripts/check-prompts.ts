import { prisma } from '@/lib/prisma'

async function main() {
    console.log('Checking prompts...\n')
    
    const prompts = await prisma.prompt.findMany({ take: 5 })
    console.log(`Found ${prompts.length} prompts:`)
    prompts.forEach(p => {
        console.log(`  - ID: ${p.id}, Name: ${p.name}, Active: ${p.isActive}`)
    })
    
    console.log('\n---\n')
    
    const agentPrompts = await prisma.agentPrompt.findMany({ 
        where: { agentId: 'cmkvfuyar00004uaximi0hhqw' }
    })
    console.log(`Found ${agentPrompts.length} agentPrompts for Lena:`)
    agentPrompts.forEach(ap => {
        console.log(`  - ID: ${ap.id}, Type: ${ap.type}, PromptID: ${ap.promptId}`)
    })
    
    await prisma.$disconnect()
}

main().catch(console.error)
