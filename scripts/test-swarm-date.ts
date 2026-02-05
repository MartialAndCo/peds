import { runSwarm } from '@/lib/swarm'
import { prisma } from '@/lib/prisma'

async function test() {
    console.log('🧪 Testing SWARM with date injection...\n')
    
    // Use existing contact (Lena's contact)
    const contact = await prisma.contact.findFirst({
        where: { name: 'Marc (Test)' }
    })
    
    if (!contact) {
        console.log('ℹ️  No test contact found, creating one...')
        // Just show timing context directly
        const { personaSchedule } = await import('@/lib/services/persona-schedule')
        const timing = personaSchedule.getContextPrompt('Europe/Paris', undefined, 'fr')
        console.log('Timing context that SWARM will use:')
        console.log(timing)
        return
    }
    
    console.log('🤖 Running SWARM...')
    const response = await runSwarm(
        "tu sais quel jour on est ?",
        [],
        contact.id,
        'cmkvfuyar00004uaximi0hhqw',
        'User',
        'text'
    )
    
    console.log('\n✅ Response:', response)
}

test().catch(console.error).finally(() => prisma.$disconnect())
