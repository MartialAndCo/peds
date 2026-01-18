import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// All prompt-related keys that can be overridden per agent
const PROMPT_KEYS = [
    // Identity & Context
    'prompt_identity_template',
    'prompt_context_template',
    'prompt_mission_template',
    // Phase Prompts
    'phase_prompt_connection',
    'phase_prompt_vulnerability',
    'phase_prompt_crisis',
    'phase_prompt_moneypot',
    // Rules & Guardrails
    'prompt_global_rules',
    'prompt_social_media_rules',
    'prompt_image_handling_rules',
    'prompt_payment_rules',
    'prompt_voice_note_policy',
    'prompt_guardrails',
    // Style
    'prompt_style_instructions',
    // Messages
    'msg_view_once_refusal',
    'msg_voice_refusal',
    // Payment Methods
    'payment_paypal_enabled',
    'payment_paypal_username',
    'payment_venmo_enabled',
    'payment_venmo_username',
    'payment_cashapp_enabled',
    'payment_cashapp_username',
    'payment_zelle_enabled',
    'payment_zelle_username',
    'payment_custom_methods',
]

// GET /api/agents/[id]/settings - Fetch agent settings with global fallbacks
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const agentId = parseInt(id)

    try {
        // Fetch agent-specific overrides
        const agentSettings = await prisma.agentSetting.findMany({
            where: { agentId }
        })

        // Fetch global settings for fallback display
        const globalSettings = await prisma.setting.findMany({
            where: { key: { in: PROMPT_KEYS } }
        })

        // Build response object
        const agentSettingsMap: Record<string, string> = {}
        agentSettings.forEach(s => { agentSettingsMap[s.key] = s.value })

        const globalSettingsMap: Record<string, string> = {}
        globalSettings.forEach(s => { globalSettingsMap[s.key] = s.value })

        return NextResponse.json({
            agentId,
            agentSettings: agentSettingsMap,
            globalSettings: globalSettingsMap,
            availableKeys: PROMPT_KEYS
        })
    } catch (error: any) {
        console.error('[AgentSettings] GET Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT /api/agents/[id]/settings - Bulk upsert agent settings
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const agentId = parseInt(id)
    const body = await req.json()

    try {
        // Verify agent exists
        const agent = await prisma.agent.findUnique({ where: { id: agentId } })
        if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

        const updates: Promise<any>[] = []

        for (const [key, value] of Object.entries(body)) {
            if (!PROMPT_KEYS.includes(key)) continue

            if (value === null || value === '' || value === undefined) {
                // Delete the override (revert to global)
                updates.push(
                    prisma.agentSetting.deleteMany({
                        where: { agentId, key }
                    })
                )
            } else {
                // Upsert the override
                updates.push(
                    prisma.agentSetting.upsert({
                        where: { agentId_key: { agentId, key } },
                        update: { value: String(value) },
                        create: { agentId, key, value: String(value) }
                    })
                )
            }
        }

        await Promise.all(updates)

        return NextResponse.json({ success: true, updated: Object.keys(body).length })
    } catch (error: any) {
        console.error('[AgentSettings] PUT Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
