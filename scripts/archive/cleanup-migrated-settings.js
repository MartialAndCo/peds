const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanupMigratedSettings() {
    console.log('=== CLEANUP: DELETE MIGRATED SETTINGS ===\n')

    // List of Settings keys that were migrated to AgentProfile
    const migratedKeys = [
        'prompt_identity_template',
        'prompt_context_template',
        'prompt_mission_template',
        'phase_prompt_connection',
        'phase_prompt_vulnerability',
        'phase_prompt_crisis',
        'phase_prompt_moneypot',
        'prompt_payment_rules',
        'prompt_style_instructions',
        'prompt_global_rules',
        'prompt_social_media_rules',
        'prompt_image_handling_rules',
        'prompt_voice_note_policy',
        'prompt_guardrails'
    ]

    console.log(`Deleting ${migratedKeys.length} migrated Settings:\n`)
    migratedKeys.forEach(key => console.log(`  - ${key}`))

    console.log('\nProceeding with deletion...\n')

    let deletedCount = 0
    for (const key of migratedKeys) {
        try {
            const result = await prisma.setting.deleteMany({
                where: { key }
            })

            if (result.count > 0) {
                console.log(`  ✅ Deleted: ${key}`)
                deletedCount++
            } else {
                console.log(`  ⏭️  Not found: ${key}`)
            }
        } catch (e) {
            console.log(`  ❌ Error deleting ${key}: ${e.message}`)
        }
    }

    console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} Settings.\n`)

    // Verify remaining settings
    const remaining = await prisma.setting.findMany({ orderBy: { key: 'asc' } })
    console.log(`Remaining Settings (${remaining.length}):`)
    remaining.forEach(s => console.log(`  - ${s.key}`))

    console.log('\nThese should be global settings like API keys, endpoints, etc.')
}

cleanupMigratedSettings()
    .catch(e => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
