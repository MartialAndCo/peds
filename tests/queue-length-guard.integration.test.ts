import { queueService } from '@/lib/services/queue-service'
import { prisma } from '@/lib/prisma'
import { LengthGuardResult } from '@/lib/services/response-length-guard'

let passed = 0
let failed = 0

function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
        passed++
        console.log(`  PASS ${testName}`)
        return
    }

    failed++
    console.log(`  FAIL ${testName}${details ? ` (${details})` : ''}`)
}

function buildGuardResult(): LengthGuardResult {
    return {
        status: 'blocked',
        text: 'too long',
        reason: 'condense_timeout',
        metrics: {
            source: 'queue.transport',
            action: 'blocked',
            attempt: 1,
            beforeWords: 30,
            afterWords: 30,
            beforeBubbles: 4,
            afterBubbles: 4
        }
    }
}

async function testQueueRequeueOnBlocked() {
    console.log('\n[TEST] queue-service requeues blocked message')

    const originalUpdate = (prisma.messageQueue as any).update
    const originalCreate = (prisma.notification as any).create
    const updates: any[] = []
    const notifications: any[] = []

    ;(prisma.messageQueue as any).update = async (args: any) => {
        updates.push(args)
        return { id: args.where.id, ...args.data }
    }
    ;(prisma.notification as any).create = async (args: any) => {
        notifications.push(args)
        return { id: 'n1' }
    }

    try {
        const before = Date.now()
        const result = await (queueService as any).handleLengthGuardBlocked(
            { id: 'q1', attempts: 0, conversationId: 10 },
            buildGuardResult(),
            'agent-1'
        )
        const after = Date.now()

        assert('result status is requeued', result.status === 'requeued', `status=${result.status}`)
        assert('one queue update', updates.length === 1, `updates=${updates.length}`)
        assert('no notification on first retry', notifications.length === 0, `notifications=${notifications.length}`)

        const updateData = updates[0]?.data
        const scheduledAt = updateData?.scheduledAt as Date
        const minExpected = before + 60_000
        const maxExpected = after + 70_000

        assert('status reset to PENDING', updateData?.status === 'PENDING', `status=${updateData?.status}`)
        assert('attempt incremented', updateData?.attempts?.increment === 1, `attempt=${JSON.stringify(updateData?.attempts)}`)
        assert('backoff around 1 minute', scheduledAt instanceof Date && scheduledAt.getTime() >= minExpected && scheduledAt.getTime() <= maxExpected, `scheduledAt=${scheduledAt?.toISOString?.()}`)
    } finally {
        ;(prisma.messageQueue as any).update = originalUpdate
        ;(prisma.notification as any).create = originalCreate
    }
}

async function testQueueFailsAfterThirdBlockedAttempt() {
    console.log('\n[TEST] queue-service fails after 3 blocked attempts')

    const originalUpdate = (prisma.messageQueue as any).update
    const originalCreate = (prisma.notification as any).create
    const updates: any[] = []
    const notifications: any[] = []

    ;(prisma.messageQueue as any).update = async (args: any) => {
        updates.push(args)
        return { id: args.where.id, ...args.data }
    }
    ;(prisma.notification as any).create = async (args: any) => {
        notifications.push(args)
        return { id: 'n2' }
    }

    try {
        const result = await (queueService as any).handleLengthGuardBlocked(
            { id: 'q2', attempts: 2, conversationId: 20 },
            buildGuardResult(),
            'agent-2'
        )

        assert('result status is failed', result.status === 'failed', `status=${result.status}`)
        assert('one queue update', updates.length === 1, `updates=${updates.length}`)
        assert('one admin notification', notifications.length === 1, `notifications=${notifications.length}`)

        const updateData = updates[0]?.data
        assert('status set to FAILED', updateData?.status === 'FAILED', `status=${updateData?.status}`)
        assert('attempt incremented on final fail', updateData?.attempts?.increment === 1, `attempt=${JSON.stringify(updateData?.attempts)}`)
        assert('notification type SYSTEM', notifications[0]?.data?.type === 'SYSTEM', `type=${notifications[0]?.data?.type}`)
    } finally {
        ;(prisma.messageQueue as any).update = originalUpdate
        ;(prisma.notification as any).create = originalCreate
    }
}

async function main() {
    console.log('=== QUEUE LENGTH GUARD INTEGRATION TESTS ===')
    await testQueueRequeueOnBlocked()
    await testQueueFailsAfterThirdBlockedAttempt()

    console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
    process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
    console.error('Fatal test error:', error)
    process.exit(1)
})
