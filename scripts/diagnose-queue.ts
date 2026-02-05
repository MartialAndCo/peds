#!/usr/bin/env tsx
/**
 * Queue Diagnostic Script
 * 
 * Usage: npx tsx scripts/diagnose-queue.ts
 * 
 * This script diagnoses issues with the message queue:
 * - Messages stuck in PROCESSING
 * - Duplicate messages
 * - Failed messages
 * - Queue statistics
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnoseQueue() {
    console.log('🔍 Diagnosing Message Queue...\n')
    
    const now = new Date()
    
    // 1. Overall statistics
    console.log('📊 OVERALL STATISTICS')
    console.log('=====================')
    
    const stats = await prisma.messageQueue.groupBy({
        by: ['status'],
        _count: { id: true }
    })
    
    for (const stat of stats) {
        console.log(`  ${stat.status}: ${stat._count.id}`)
    }
    
    // 2. Messages stuck in PROCESSING
    console.log('\n⏳ PROCESSING MESSAGES (Potentially Stuck)')
    console.log('==========================================')
    
    const processingMessages = await prisma.messageQueue.findMany({
        where: { status: 'PROCESSING' },
        orderBy: { updatedAt: 'asc' },
        take: 10,
        include: {
            contact: { select: { phone_whatsapp: true, name: true } },
            conversation: { select: { id: true, agentId: true } }
        }
    })
    
    if (processingMessages.length === 0) {
        console.log('  ✅ No messages stuck in PROCESSING')
    } else {
        for (const msg of processingMessages) {
            const minutesStuck = Math.round((now.getTime() - msg.updatedAt.getTime()) / 60000)
            console.log(`  ⚠️  ID: ${msg.id}`)
            console.log(`     Contact: ${msg.contact?.name || 'Unknown'} (${msg.contact?.phone_whatsapp})`)
            console.log(`     Agent: ${msg.conversation?.agentId || 'Unknown'}`)
            console.log(`     Attempts: ${msg.attempts}`)
            console.log(`     Updated: ${minutesStuck} minutes ago`)
            console.log(`     Content Preview: ${msg.content?.substring(0, 50)}...`)
            console.log('')
        }
    }
    
    // 3. Failed messages
    console.log('\n❌ FAILED MESSAGES')
    console.log('==================')
    
    const failedMessages = await prisma.messageQueue.findMany({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
            contact: { select: { phone_whatsapp: true, name: true } }
        }
    })
    
    if (failedMessages.length === 0) {
        console.log('  ✅ No failed messages')
    } else {
        for (const msg of failedMessages) {
            console.log(`  ID: ${msg.id}`)
            console.log(`  Contact: ${msg.contact?.name || 'Unknown'}`)
            console.log(`  Error: ${msg.error || 'Unknown error'}`)
            console.log(`  Attempts: ${msg.attempts}`)
            console.log('')
        }
    }
    
    // 4. Pending messages (future)
    console.log('\n📅 PENDING MESSAGES (Scheduled)')
    console.log('================================')
    
    const upcomingMessages = await prisma.messageQueue.findMany({
        where: { 
            status: 'PENDING',
            scheduledAt: { gt: now }
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
        include: {
            contact: { select: { phone_whatsapp: true, name: true } }
        }
    })
    
    if (upcomingMessages.length === 0) {
        console.log('  No upcoming messages')
    } else {
        for (const msg of upcomingMessages) {
            const minutesUntil = Math.round((msg.scheduledAt.getTime() - now.getTime()) / 60000)
            console.log(`  ID: ${msg.id}`)
            console.log(`  Contact: ${msg.contact?.name || 'Unknown'}`)
            console.log(`  Scheduled in: ${minutesUntil} minutes`)
            console.log(`  Content Preview: ${msg.content?.substring(0, 50)}...`)
            console.log('')
        }
    }
    
    // 5. Duplicate detection
    console.log('\n🔍 POTENTIAL DUPLICATES')
    console.log('=======================')
    
    const recentMessages = await prisma.messageQueue.findMany({
        where: {
            createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } // Last hour
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    })
    
    const duplicates = new Map<string, typeof recentMessages>()
    
    for (const msg of recentMessages) {
        const key = `${msg.contactId}_${msg.content?.substring(0, 100)}`
        if (!duplicates.has(key)) {
            duplicates.set(key, [])
        }
        duplicates.get(key)!.push(msg)
    }
    
    let dupCount = 0
    for (const [key, msgs] of duplicates.entries()) {
        if (msgs.length > 1) {
            dupCount++
            console.log(`  ⚠️  Found ${msgs.length} similar messages:`)
            for (const msg of msgs) {
                console.log(`     - ID: ${msg.id}, Status: ${msg.status}, Created: ${msg.createdAt.toISOString()}`)
            }
        }
    }
    
    if (dupCount === 0) {
        console.log('  ✅ No duplicates detected in last hour')
    }
    
    // 6. Recommendations
    console.log('\n💡 RECOMMENDATIONS')
    console.log('==================')
    
    const stuckCount = processingMessages.filter(m => 
        (now.getTime() - m.updatedAt.getTime()) > 10 * 60 * 1000
    ).length
    
    if (stuckCount > 0) {
        console.log(`  ⚠️  ${stuckCount} messages stuck for >10 minutes. Run cleanup or investigate.`)
    }
    
    if (failedMessages.length > 10) {
        console.log(`  ⚠️  ${failedMessages.length} failed messages. Consider reviewing errors.`)
    }
    
    const veryOldProcessing = processingMessages.filter(m => 
        (now.getTime() - m.updatedAt.getTime()) > 60 * 60 * 1000
    ).length
    
    if (veryOldProcessing > 0) {
        console.log(`  🚨 ${veryOldProcessing} messages stuck for >1 hour! Manual intervention needed.`)
    }
    
    console.log('\n✅ Diagnosis complete!')
}

diagnoseQueue()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
