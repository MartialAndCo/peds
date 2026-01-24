const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function detailedPromptAnalysis() {
    const output = []

    function log(msg) {
        console.log(msg)
        output.push(msg)
    }

    log('=== DETAILED PROMPT SETTINGS ANALYSIS ===\n')

    // Get all settings
    const allSettings = await prisma.setting.findMany({
        orderBy: { key: 'asc' }
    })

    log(`Total Settings: ${allSettings.length}\n`)

    // Categorize
    const promptRelated = []
    const other = []

    for (const setting of allSettings) {
        const key = setting.key.toLowerCase()
        if (
            key.includes('prompt') ||
            key.includes('phase') ||
            key.includes('style') ||
            key.includes('rules') ||
            key.includes('persona') ||
            key.includes('base_role') ||
            key.includes('context')
        ) {
            promptRelated.push(setting)
        } else {
            other.push(setting)
        }
    }

    log('=== PROMPT-RELATED SETTINGS (SHOULD BE PER-AGENT) ===\n')
    for (const s of promptRelated) {
        log(`📝 Key: ${s.key}`)
        const preview = s.value ? s.value.substring(0, 150).replace(/\n/g, ' ') : 'null'
        log(`   Value: ${preview}${s.value && s.value.length > 150 ? '...' : ''}`)
        log('')
    }

    log(`\nTotal prompt-related: ${promptRelated.length}`)
    log(`Total other settings: ${other.length}`)

    // Check current agent profiles
    log('\n=== CURRENT AGENT PROFILES ===\n')
    const agents = await prisma.agent.findMany({
        include: { profile: true },
        orderBy: { createdAt: 'asc' }
    })

    for (const agent of agents) {
        log(`Agent: ${agent.name} (${agent.id})`)
        if (agent.profile) {
            log(`  ✅ Has profile`)
            log(`     - Phases: ${agent.profile.phases ? 'Yes' : 'No'}`)
            log(`     - Style: ${agent.profile.style ? 'Yes' : 'No'}`)
            log(`     - Rules: ${agent.profile.rules ? 'Yes' : 'No'}`)
        } else {
            log(`  ❌ NO PROFILE`)
        }
        log('')
    }

    // Write to file
    fs.writeFileSync('prompt-analysis-report.txt', output.join('\n'))
    log('Report written to: prompt-analysis-report.txt')
}

detailedPromptAnalysis()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
