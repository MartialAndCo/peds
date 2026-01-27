import { prisma } from '../lib/prisma'
import fs from 'fs'
import path from 'path'

/**
 * PRUNE SESSIONS SCRIPT
 * 
 * Compares folders in services/baileys/auth_info_baileys with active agents in DB.
 * Helps identify which folders are "Zombies" (no matching agent).
 */
async function main() {
    console.log('--- SESSION PRUNE UTILITY ---')

    // 1. Get all agents and their configured sessions
    const agents = await prisma.agentProfile.findMany({
        select: { agentId: true, displayName: true }
    })

    const agentSettings = await prisma.agentSetting.findMany({
        where: { key: 'waha_id' }
    })

    const validIds = new Set<string>()
    agents.forEach(a => validIds.add(a.agentId))
    agentSettings.forEach(s => {
        if (s.value) validIds.add(s.value.toString())
    })

    console.log(`[DB] Found ${agents.length} agents and ${agentSettings.length} custom session IDs.`)
    console.log(`[DB] Valid Session IDs:`, Array.from(validIds))

    // 2. Scan auth_info_baileys
    const authDir = path.join(process.cwd(), 'services', 'baileys', 'auth_info_baileys')
    if (!fs.existsSync(authDir)) {
        console.error(`Directory not found: ${authDir}`)
        process.exit(1)
    }

    const folders = fs.readdirSync(authDir).filter(f => f.startsWith('session_'))
    console.log(`[Disk] Found ${folders.length} session folders in ${authDir}`)

    const zombies: string[] = []
    const active: string[] = []

    for (const folder of folders) {
        const id = folder.replace('session_', '')
        if (validIds.has(id)) {
            active.push(folder)
        } else {
            zombies.push(folder)
        }
    }

    console.log('\n--- RESULTS ---')
    console.log(`✅ ACTIVE (${active.length}):`, active.join(', '))

    if (zombies.length > 0) {
        console.log(`🚨 ZOMBIES (${zombies.length}):`, zombies.join(', '))
        console.log('\nTo clean up zombies, run:')
        zombies.forEach(z => {
            console.log(`rm -rf "${path.join(authDir, z)}"`)
        })
    } else {
        console.log('✨ No zombies found!')
    }

    await prisma.$disconnect()
}

main().catch(console.error)
