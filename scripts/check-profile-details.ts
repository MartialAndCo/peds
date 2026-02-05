import { prisma } from '@/lib/prisma'
import { runSwarm } from '@/lib/swarm'

async function check() {
    const agentId = 'cmkvfuyar00004uaximi0hhqw'
    
    console.log('🔍 Checking SWARM profile details...\n')
    
    // Get profile exactly like SWARM does
    const profile = await prisma.agentProfile.findUnique({
        where: { agentId },
        select: {
            contextTemplate: true,
            styleRules: true,
            identityTemplate: true,
            phaseConnectionTemplate: true,
            phaseVulnerabilityTemplate: true,
            phaseCrisisTemplate: true,
            phaseMoneypotTemplate: true,
            paymentRules: true,
            safetyRules: true,
            timezone: true,
            locale: true
        }
    })
    
    if (!profile) {
        console.log('❌ NO PROFILE FOUND')
        return
    }
    
    console.log('Profile found:')
    Object.entries(profile).forEach(([key, value]) => {
        if (typeof value === 'string') {
            console.log(`  ${key}: ${value ? value.substring(0, 80) + '...' : 'NULL'} (${value.length} chars)`)
        } else {
            console.log(`  ${key}: ${value}`)
        }
    })
    
    // Check if any critical field is empty
    const criticalFields = ['identityTemplate', 'styleRules']
    const emptyFields = criticalFields.filter(f => !profile[f as keyof typeof profile])
    
    if (emptyFields.length > 0) {
        console.log('\n❌ CRITICAL FIELDS EMPTY:', emptyFields)
        console.log('This would cause the SWARM to fail!')
    }
    
    // Try to run SWARM with a test contact
    console.log('\n🧪 Testing SWARM execution...')
    const contact = await prisma.contact.findFirst()
    if (contact) {
        try {
            const response = await runSwarm(
                "salut",
                [],
                contact.id,
                agentId,
                'Test',
                'text'
            )
            console.log('\n✅ SWARM Response:', response)
        } catch (error: any) {
            console.error('\n❌ SWARM Error:', error.message)
        }
    }
}

check().then(() => process.exit()).catch(console.error)
