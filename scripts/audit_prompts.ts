
import { prisma } from '../lib/prisma'

async function main() {
    console.log("=== PROMPT AUDIT START ===")

    // 1. Fetch Global Settings
    const settingsKeys = [
        'prompt_style_instructions',
        'prompt_image_handling_rules',
        'prompt_payment_rules',
        'prompt_social_rules',
        'prompt_guardrails'
    ]
    const settings = await prisma.setting.findMany({
        where: { key: { in: settingsKeys } }
    })

    console.log("\n--- GLOBAL SETTINGS ---")
    settings.forEach(s => {
        console.log(`\n[${s.key}]:`)
        console.log(s.value)
    })

    // 2. Fetch All Prompts
    const prompts = await prisma.prompt.findMany()
    console.log(`\n--- FOUND ${prompts.length} PROMPTS ---`)
    prompts.forEach(p => {
        console.log(`\n[Prompt: ${p.name}]:`)
        console.log(p.system_prompt)
    })

    console.log("\n=== AUDIT END ===")
}

main().catch(console.error)
