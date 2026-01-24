const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkEverything() {
    console.log('=== DIAGNOSTIC: WHERE IS THE PROMPT DATA? ===\n')

    // 1. Check Settings
    console.log('1. SETTINGS TABLE:')
    const settings = await prisma.setting.findMany()
    console.log(`   Total entries: ${settings.length}`)

    const promptKeys = settings.filter(s =>
        s.key.toLowerCase().includes('prompt') ||
        s.key.toLowerCase().includes('phase') ||
        s.key.toLowerCase().includes('template') ||
        s.key.toLowerCase().includes('role')
    )
    console.log(`   Prompt-related: ${promptKeys.length}`)

    if (promptKeys.length > 0) {
        console.log('\n   Found prompt keys:')
        promptKeys.forEach(s => {
            console.log(`     - ${s.key}: ${s.value ? s.value.length + ' chars' : 'null'}`)
        })
    }

    // 2. Check AgentProfiles
    console.log('\n2. AGENT PROFILES:')
    const agents = await prisma.agent.findMany({ include: { profile: true } })

    for (const agent of agents) {
        console.log(`\n   Agent: ${agent.name}`)
        if (!agent.profile) {
            console.log(`     ❌ NO PROFILE`)
            continue
        }

        const p = agent.profile
        console.log(`     Profile ID: ${p.id}`)
        console.log(`     phaseConnectionTemplate: ${p.phaseConnectionTemplate ? p.phaseConnectionTemplate.length + ' chars' : 'null'}`)
        console.log(`     phaseVulnerabilityTemplate: ${p.phaseVulnerabilityTemplate ? p.phaseVulnerabilityTemplate.length + ' chars' : 'null'}`)
        console.log(`     phaseCrisisTemplate: ${p.phaseCrisisTemplate ? p.phaseCrisisTemplate.length + ' chars' : 'null'}`)
        console.log(`     contextTemplate: ${p.contextTemplate ? p.contextTemplate.length + ' chars' : 'null'}`)
        console.log(`     missionTemplate: ${p.missionTemplate ? p.missionTemplate.length + ' chars' : 'null'}`)
    }

    console.log('\n3. CONCLUSION:')
    if (promptKeys.length === 0 && agents.every(a => !a.profile || !a.profile.phaseConnectionTemplate)) {
        console.log('   ⚠️  NO PROMPT DATA FOUND ANYWHERE')
        console.log('   The prompts may have been deleted or never existed')
    } else if (promptKeys.length > 0) {
        console.log('   ✅ Prompt data found in Settings - migration needed')
    } else {
        console.log('   ✅ Prompt data already in AgentProfiles')
    }
}

checkEverything()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
