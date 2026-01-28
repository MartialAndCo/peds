import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Mapping Frontend Keys -> DB Columns (AgentProfile)
const KEY_MAP: Record<string, string> = {
    // Identity
    'prompt_identity_template': 'identityTemplate',
    'prompt_context_template': 'contextTemplate',
    'prompt_mission_template': 'missionTemplate',

    // Phases
    'phase_prompt_connection': 'phaseConnectionTemplate',
    'phase_prompt_vulnerability': 'phaseVulnerabilityTemplate',
    'phase_prompt_crisis': 'phaseCrisisTemplate',
    'phase_prompt_moneypot': 'phaseMoneypotTemplate',

    // Rules
    'prompt_global_rules': 'safetyRules', // Uses safetyRules for global
    'prompt_payment_rules': 'paymentRules',
    'prompt_style_instructions': 'styleRules',

    // Payment Config (Mapped to AgentProfile)
    'paypal_email': 'paypalEmail',
    'cashapp_tag': 'cashappTag',
    'venmo_handle': 'venmoHandle',
    'bank_account_number': 'bankAccountNumber',
    'bank_routing_number': 'bankRoutingNumber',

    // We map unused UI keys to safetyRules to assume they are aggregated there, 
    // or we ignore them if they don't map well. 
    // For now, let's map what we have in DB.
}

// Keys that are actual AgentSettings (KV table), not Profile columns
const SETTING_KEYS = [
    'payment_paypal_enabled', 'payment_paypal_username',
    'payment_venmo_enabled', 'payment_venmo_username',
    'payment_cashapp_enabled', 'payment_cashapp_username',
    'payment_zelle_enabled', 'payment_zelle_username',
    'payment_custom_methods',
    'voice_response_enabled'
    // 'phase_limit_*' etc if we added them to profile? Profile has fastTrackDays only. 
    // The UI sends phase_limit_trust_medium etc. These remain in Settings for now or need migration.
]

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const agentId = id

    try {
        // 1. Fetch Profile (Source of Truth for Prompts)
        const profile = await prisma.agentProfile.findUnique({ where: { agentId } })

        // 2. Fetch Settings (Source of Truth for Configs like Payment Toggles)
        const settings = await prisma.agentSetting.findMany({ where: { agentId } })

        const responseData: Record<string, string> = {}

        // Map Profile -> Frontend Keys
        if (profile) {
            Object.entries(KEY_MAP).forEach(([feKey, dbCol]) => {
                const val = (profile as any)[dbCol]
                if (val) responseData[feKey] = val
            })

            // Map specific profile fields that don't match KEY_MAP perfectly
            // e.g. baseAge
        }

        // Map Settings -> Frontend Keys
        settings.forEach(s => {
            responseData[s.key] = s.value
        })

        return NextResponse.json({
            agentId,
            agentSettings: responseData,
            globalSettings: {}, // Legacy fallback
            availableKeys: [...Object.keys(KEY_MAP), ...SETTING_KEYS]
        })
    } catch (error: any) {
        console.error('[Settings] GET Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const agentId = id

    try {
        const body = await req.json()

        // Prepare updates
        const profileUpdates: Record<string, any> = {}
        // Type fix: Use 'any[]' because Prisma.$transaction expects PrismaPromise[] 
        // but we were explicitly typing as Promise<any>[] which is not assignable.
        const settingUpserts: any[] = []

        for (const [key, value] of Object.entries(body)) {
            // Case A: It's a Profile Field
            if (KEY_MAP[key]) {
                profileUpdates[KEY_MAP[key]] = value
            }
            // Case B: It's a traditional Setting
            else {
                // If value is empty, delete? Or just set empty string.
                // UI sends empty string for reset.
                if (value === null || value === undefined) continue

                settingUpserts.push(
                    prisma.agentSetting.upsert({
                        where: { agentId_key: { agentId, key } },
                        update: { value: String(value) },
                        create: { agentId, key, value: String(value) }
                    })
                )
            }
        }

        // Execute Profile Update
        if (Object.keys(profileUpdates).length > 0) {
            await prisma.agentProfile.upsert({
                where: { agentId },
                update: profileUpdates,
                create: {
                    agentId,
                    ...profileUpdates
                }
            })
        }

        // Execute Settings Upserts
        if (settingUpserts.length > 0) {
            await prisma.$transaction(settingUpserts)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[Settings] PUT Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
