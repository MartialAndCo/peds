// scripts/rollback-agent-profile.ts
// Rollback an agent profile from a backup file
// Run: npx ts-node scripts/rollback-agent-profile.ts <backup-file.json>

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
    const backupFile = process.argv[2]

    if (!backupFile) {
        console.error('❌ Usage: npx ts-node scripts/rollback-agent-profile.ts <backup-file.json>')
        console.log('\nAvailable backup files:')
        const files = fs.readdirSync('.').filter(f => f.endsWith('-backup-') || f.includes('backup'))
        files.forEach(f => console.log(`   - ${f}`))
        await prisma.$disconnect()
        return
    }

    if (!fs.existsSync(backupFile)) {
        console.error(`❌ Backup file not found: ${backupFile}`)
        await prisma.$disconnect()
        return
    }

    console.log(`🔄 Rolling back from: ${backupFile}\n`)

    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'))

    console.log('📋 Backup contents:')
    console.log(`   - identityTemplate: ${backup.identityTemplate?.length || 0} chars`)
    console.log(`   - safetyRules: ${backup.safetyRules?.length || 0} chars`)
    console.log(`   - styleRules: ${backup.styleRules?.length || 0} chars`)
    console.log(`   - timestamp: ${backup.timestamp}`)

    // Determine which agent based on filename
    const isAnais = backupFile.toLowerCase().includes('anais')
    const isLena = backupFile.toLowerCase().includes('lena')

    let agentId: string
    let agentName: string

    if (isAnais) {
        agentId = 'cmkvg0kzz00003vyv03zzt9kc'
        agentName = 'Anaïs'
    } else if (isLena) {
        agentId = 'cmkvfuyar00004uaximi0hhqw'
        agentName = 'Lena'
    } else {
        console.error('❌ Could not determine agent from filename. Name must contain "anais" or "lena".')
        await prisma.$disconnect()
        return
    }

    console.log(`\n🎯 Target agent: ${agentName} (${agentId})`)

    // Apply rollback
    await prisma.agentProfile.update({
        where: { agentId },
        data: {
            identityTemplate: backup.identityTemplate,
            safetyRules: backup.safetyRules,
            styleRules: backup.styleRules,
            updatedAt: new Date()
        }
    })

    console.log('\n✅ Rollback complete!')

    // Verify
    const updated = await prisma.agentProfile.findUnique({
        where: { agentId }
    })

    console.log('\n📋 Restored Profile:')
    console.log(`   - identityTemplate: ${updated?.identityTemplate?.length || 0} chars`)
    console.log(`   - safetyRules: ${updated?.safetyRules?.length || 0} chars`)
    console.log(`   - styleRules: ${updated?.styleRules?.length || 0} chars`)

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
})
