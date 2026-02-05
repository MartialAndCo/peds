import { prisma } from '@/lib/prisma'

async function disableSwarm() {
    console.log('🔧 Disabling SWARM mode (fallback to CLASSIC)...\n')
    
    await prisma.setting.upsert({
        where: { key: 'ai_mode' },
        update: { value: 'CLASSIC' },
        create: { key: 'ai_mode', value: 'CLASSIC' }
    })
    
    console.log('✅ AI_MODE set to CLASSIC')
    console.log('The system will now use classic prompt mode instead of SWARM.')
    console.log('\n⚠️  Remember to recharge your Venice AI credits!')
    console.log('Then you can re-enable SWARM by setting AI_MODE back to SWARM.')
}

disableSwarm().then(() => process.exit()).catch(console.error)
