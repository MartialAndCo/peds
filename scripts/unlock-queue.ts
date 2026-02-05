#!/usr/bin/env tsx
/**
 * Queue Unlock Script
 * 
 * Usage: 
 *   npx tsx scripts/unlock-queue.ts --dry-run    # Preview what would be unlocked
 *   npx tsx scripts/unlock-queue.ts --execute    # Actually unlock messages
 *   npx tsx scripts/unlock-queue.ts --force      # Unlock even if attempts >= 3
 * 
 * This script resets stuck messages from PROCESSING back to PENDING.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function unlockQueue() {
    const args = process.argv.slice(2)
    const dryRun = args.includes('--dry-run')
    const execute = args.includes('--execute')
    const force = args.includes('--force')
    
    if (!dryRun && !execute) {
        console.log('🔒 Queue Unlock Script')
        console.log('')
        console.log('Usage:')
        console.log('  npx tsx scripts/unlock-queue.ts --dry-run    # Preview only')
        console.log('  npx tsx scripts/unlock-queue.ts --execute    # Actually unlock')
        console.log('  npx tsx scripts/unlock-queue.ts --force      # Unlock even with max attempts')
        console.log('')
        console.log('Run with --dry-run first to see what would be affected.')
        process.exit(1)
    }
    
    const now = new Date()
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)
    
    console.log(dryRun ? '🔍 DRY RUN MODE' : '🔓 EXECUTE MODE')
    console.log('================\n')
    
    // Find stuck messages
    const stuckMessages = await prisma.messageQueue.findMany({
        where: {
            status: 'PROCESSING',
            updatedAt: { lt: tenMinutesAgo },
            ...(force ? {} : { attempts: { lt: 3 } })
        },
        orderBy: { updatedAt: 'asc' },
        include: {
            contact: { select: { phone_whatsapp: true, name: true } }
        }
    })
    
    console.log(`Found ${stuckMessages.length} messages stuck in PROCESSING (>10 minutes)\n`)
    
    if (stuckMessages.length === 0) {
        console.log('✅ No stuck messages found. Queue is healthy!')
        process.exit(0)
    }
    
    for (const msg of stuckMessages) {
        const minutesStuck = Math.round((now.getTime() - msg.updatedAt.getTime()) / 60000)
        console.log(`ID: ${msg.id}`)
        console.log(`  Contact: ${msg.contact?.name || 'Unknown'} (${msg.contact?.phone_whatsapp})`)
        console.log(`  Stuck for: ${minutesStuck} minutes`)
        console.log(`  Attempts: ${msg.attempts}`)
        console.log(`  Content: ${msg.content?.substring(0, 100)}...`)
        console.log('')
    }
    
    if (dryRun) {
        console.log('\n📝 This was a dry run. No changes were made.')
        console.log('Run with --execute to actually unlock these messages.')
    } else {
        // Actually unlock
        const result = await prisma.messageQueue.updateMany({
            where: {
                id: { in: stuckMessages.map(m => m.id) }
            },
            data: {
                status: 'PENDING',
                attempts: { increment: 1 }
            }
        })
        
        console.log(`\n✅ Unlocked ${result.count} messages. They will be processed in the next CRON run.`)
        console.log('Note: Attempt count was incremented to track retries.')
    }
}

unlockQueue()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
