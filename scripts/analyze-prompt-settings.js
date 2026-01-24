const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function analyzePromptSettings() {
    console.log('=== ANALYZING GLOBAL SETTINGS ===\n')

    // Get all settings
    const allSettings = await prisma.setting.findMany({
        orderBy: { key: 'asc' }
    })

    console.log(`Total settings: ${allSettings.length}\n`)

    // Filter prompt-related
    const promptKeys = allSettings.filter(s =>
        s.key.includes('prompt') ||
        s.key.includes('phase') ||
        s.key.includes('style') ||
        s.key.includes('rules') ||
        s.key.includes('persona')
    )

    console.log('=== PROMPT-RELATED SETTINGS ===\n')
    for (const setting of promptKeys) {
        console.log(`Key: ${setting.key}`)
        console.log(`Value: ${setting.value?.substring(0, 100)}${setting.value?.length > 100 ? '...' : ''}`)
        console.log('---')
    }

    // Check AgentProfile structure
    console.log('\n=== CURRENT AGENT PROFILES ===\n')
    const profiles = await prisma.agentProfile.findMany({
        include: { agent: { select: { name: true } } }
    })

    console.log(`Total AgentProfiles: ${profiles.length}\n`)
    for (const profile of profiles) {
        console.log(`Agent: ${profile.agent.name}`)
        console.log(`Has phases: ${!!profile.phases}`)
        console.log(`Has style: ${!!profile.style}`)
        console.log(`Has rules: ${!!profile.rules}`)
        console.log('---')
    }

    console.log('\n=== RECOMMENDATIONS ===\n')
    if (promptKeys.length > 0) {
        console.log(`Found ${promptKeys.length} prompt-related settings in global Settings`)
        console.log('These should be migrated to AgentProfile per agent')
    }
}

analyzePromptSettings()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
