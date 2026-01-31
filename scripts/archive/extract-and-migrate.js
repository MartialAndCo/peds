const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function extractAndMigrate() {
    const log = []
    function write(msg) {
        console.log(msg)
        log.push(msg)
    }

    write('=== EXTRACT AND MIGRATE ===\n')

    // Get ALL settings
    const allSettings = await prisma.setting.findMany()
    const s = {}
    allSettings.forEach(setting => s[setting.key] = setting.value)

    write(`Total Settings: ${allSettings.length}\n`)
    write('All keys:')
    Object.keys(s).forEach(key => write(`  - ${key}`))

    // Find prompt-related ones
    const promptSettings = Object.keys(s).filter(key =>
        key.includes('PHASE') || key.includes('phase') ||
        key.includes('template') || key.includes('Template') ||
        key.includes('ROLE') || key.includes('role') ||
        key.includes('rules') || key.includes('RULES')
    )

    write(`\nPrompt-related keys (${promptSettings.length}):`)
    promptSettings.forEach(key => {
        const val = s[key]
        write(`  ${key}: ${val ? val.length + ' chars' : 'null'}`)
    })

    // Agents
    const agents = await prisma.agent.findMany({ include: { profile: true } })
    write(`\nAgents: ${agents.length}\n`)

    // Migrate
    write('Starting migration...\n')

    for (const agent of agents) {
        write(`Agent: ${agent.name}`)

        // Try to find matching keys
        const data = {}

        // Common patterns
        const keyMappings = [
            ['PHASE_CONNECTION', 'phaseConnectionTemplate'],
            ['PHASE_VULNERABILITY', 'phaseVulnerabilityTemplate'],
            ['PHASE_CRISIS', 'phaseCrisisTemplate'],
            ['PHASE_MONEYPOT', 'phaseMoneypotTemplate'],
            ['ROLE', 'baseRole'],
            ['context_template', 'contextTemplate'],
            ['mission_template', 'missionTemplate'],
            ['identity_template', 'identityTemplate'],
            ['payment_rules', 'paymentRules'],
            ['safety_rules', 'safetyRules'],
            ['style_rules', 'styleRules']
        ]

        for (const [settingKey, profileField] of keyMappings) {
            const value = s[settingKey]
            if (value) {
                data[profileField] = value
                write(`  Mapping ${settingKey} -> ${profileField}`)
            }
        }

        if (Object.keys(data).length === 0) {
            write(`  ⚠️  No data to migrate`)
            continue
        }

        if (agent.profile) {
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data
            })
            write(`  ✅ Updated profile with ${Object.keys(data).length} fields`)
        } else {
            await prisma.agentProfile.create({
                data: { agentId: agent.id, ...data }
            })
            write(`  ✅ Created profile with ${Object.keys(data).length} fields`)
        }
    }

    fs.writeFileSync('migration-log.txt', log.join('\n'))
    write('\nLog saved to migration-log.txt')
}

extractAndMigrate()
    .catch(e => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
