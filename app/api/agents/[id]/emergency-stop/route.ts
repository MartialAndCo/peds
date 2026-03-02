import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { action } = await req.json() // 'freeze' | 'resume'
        const agentId = params.id

        if (!agentId) {
            return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })
        }

        if (action === 'freeze') {
            console.log(`[EMERGENCY STOP] Triggered FREEZE for Agent ${agentId}`)

            // 1. Disable the agent
            await prisma.agent.update({
                where: { id: agentId },
                data: { isActive: false }
            })

            // 2. Disable AI for all active conversations of this agent
            await prisma.conversation.updateMany({
                where: {
                    agentId,
                    status: 'active'
                },
                data: { ai_enabled: false }
            })

            // 3. Clear IncomingQueue
            await prisma.incomingQueue.updateMany({
                where: {
                    agentId,
                    status: { in: ['PENDING', 'PROCESSING', 'AI_PROCESSING'] }
                },
                data: {
                    status: 'CANCELLED',
                    error: 'Cancelled via Emergency Stop'
                }
            })

            // 4. Clear MessageQueue (outgoing)
            await prisma.messageQueue.updateMany({
                where: {
                    conversation: { agentId },
                    status: { in: ['PENDING', 'PROCESSING'] }
                },
                data: {
                    status: 'CANCELLED',
                    error: 'Cancelled via Emergency Stop'
                }
            })

            // 5. Cancel any pending Voice validation requests
            await prisma.pendingVoiceValidation.updateMany({
                where: {
                    agentId,
                    status: 'PENDING'
                },
                data: {
                    status: 'REJECTED'
                }
            })

            return NextResponse.json({
                success: true,
                message: 'Emergency Stop engaged. Queues cleared and AI disabled.'
            })
        }

        if (action === 'resume') {
            console.log(`[EMERGENCY STOP] Triggered RESUME for Agent ${agentId}`)

            // 1. Re-enable the agent
            await prisma.agent.update({
                where: { id: agentId },
                data: { isActive: true }
            })

            // 2. Re-enable AI for active conversations
            // (Note: They will not resume generating automatically for past messages due to queue clearing, 
            // but they will respond to the NEXT incoming message from the user normally.)
            await prisma.conversation.updateMany({
                where: {
                    agentId,
                    status: 'active'
                },
                data: { ai_enabled: true }
            })

            return NextResponse.json({
                success: true,
                message: 'AI Resumed. The agent is active again.'
            })
        }

        return NextResponse.json({ error: 'Invalid action. Must be "freeze" or "resume"' }, { status: 400 })

    } catch (e: any) {
        console.error('[EMERGENCY STOP] Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
