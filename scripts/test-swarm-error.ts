import { runSwarm } from '@/lib/swarm'
import { prisma } from '@/lib/prisma'

async function test() {
    console.log('🧪 Testing SWARM error handling...\n')
    
    // Get first active conversation
    const conv = await prisma.conversation.findFirst({
        where: { status: 'active' },
        include: { contact: true }
    })
    
    if (!conv) {
        console.log('No active conversation found')
        return
    }
    
    console.log('Testing with conversation:', conv.id)
    console.log('Agent:', conv.agentId)
    console.log('Contact:', conv.contact.phone_whatsapp)
    
    try {
        const response = await runSwarm(
            "ça va ?",
            [],
            conv.contactId,
            conv.agentId!,
            conv.contact.name || 'User',
            'text'
        )
        console.log('\n✅ Response:', response)
        
        if (response === 'jsuis là') {
            console.log('\n❌ GOT FALLBACK RESPONSE - This means an error occurred!')
        }
    } catch (error: any) {
        console.error('\n❌ Error:', error.message)
    }
}

test().then(() => process.exit()).catch(console.error)
