import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'

/**
 * ADMIN API: Prune Baileys Zombie Sessions
 * 
 * Fetches all valid session IDs (Agent IDs and custom waha_id settings)
 * and tells the Baileys service to delete any folders that don't match.
 */
export async function POST(req: Request) {
    try {
        // 1. Security Check (Admin only)
        // Note: You might want to add session-based auth check here if using with a UI
        const secret = req.headers.get('x-internal-secret')
        const expectedSecret = process.env.WEBHOOK_SECRET
        if (expectedSecret && secret !== expectedSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[Admin] Starting WhatsApp session pruning...')

        // 2. Identify all VALID session IDs
        // Get all agents
        const agents = await prisma.agent.findMany({
            select: { id: true }
        })

        // Get all custom waha_id settings
        const agentSettings = await prisma.agentSetting.findMany({
            where: { key: 'waha_id' },
            select: { value: true }
        })

        const keepIds = new Set<string>()
        keepIds.add('default')
        agents.forEach(a => keepIds.add(a.id))
        agentSettings.forEach(s => {
            if (s.value) keepIds.add(s.value.toString())
        })

        const keepList = Array.from(keepIds)
        console.log(`[Admin] Valid Session IDs to preserve:`, keepList)

        // 3. Call Baileys Service Prune Endpoint
        const { endpoint, apiKey } = await (whatsapp as any).getConfig()

        try {
            const { default: axios } = await import('axios')
            const response = await axios.post(`${endpoint}/api/admin/prune`, {
                keepIds: keepList
            }, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 30000
            })

            logger.info('WhatsApp sessions pruned successfully', {
                module: 'admin',
                deleted: response.data.deleted,
                preserved: response.data.preserved
            })

            return NextResponse.json({
                success: true,
                ...response.data
            })
        } catch (err: any) {
            console.error('[Admin] Baileys prune call failed:', err.message)
            return NextResponse.json({
                error: 'Baileys service failed to prune: ' + err.message
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error('[Admin] Prune error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
