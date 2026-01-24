
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log("--- SYSTEM HEALTH AUDIT ---")

    // 1. Check Contact (Yann) to see what Prompt/Agent he is on
    const yann = await prisma.contact.findFirst({ where: { phone_whatsapp: { contains: '695472237' } } })
    console.log(`\n[Test User State]`)
    if (yann) {
        console.log(`- Yann ID: ${yann.id}`)
        console.log(`- Trust: ${yann.trustScore}`)
        console.log(`- Phase: ${yann.agentPhase}`)
    } else {
        console.log("- Yann not found (DB Reset confirmed)")
    }

    // 2. Check Critical Settings
    const criticalKeys = [
        'prompt_global_rules',
        'prompt_style_instructions',
        'prompt_image_handling_rules',
        'prompt_payment_rules',
        'prompt_identity_template',
        'prompt_mission_template',
        'phase_prompt_connection',
        'phase_prompt_vulnerability',
        'phase_prompt_crisis',
        'phase_prompt_moneypot'
    ]

    console.log(`\n[Settings Audit]`)
    for (const key of criticalKeys) {
        const s = await prisma.setting.findUnique({ where: { key } })
        if (!s) {
            console.log(`❌ ${key}: MISSING`)
        } else {
            console.log(`✅ ${key}: PRESENT (Length: ${s.value.length})`)
            console.log(`   Preview: ${s.value.substring(0, 50).replace(/\n/g, ' ')}...`)
        }
    }

    // 3. Check Agent Prompts
    const agents = await prisma.agent.findMany({ include: { settings: true } })
    console.log(`\n[Agents Found]: ${agents.length}`)
    agents.forEach(a => {
        console.log(`- Agent: ${a.name} (Phone: ${a.phone})`)
        console.log(`  Settings Override Count: ${a.settings.length}`)
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())
