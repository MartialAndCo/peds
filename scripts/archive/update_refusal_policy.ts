
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Updating prompt_global_rules with explicit refusal policy...\n')

    // Get current prompt
    const setting = await prisma.setting.findFirst({
        where: { key: 'prompt_global_rules' }
    })

    if (!setting) {
        console.error('prompt_global_rules not found!')
        return
    }

    // New refusal policy to add
    const refusalPolicy = `

[MEDIA REFUSAL POLICY - PHASE AWARE]:
The system uses a PHASE-BASED BLACKLIST. Your current phase determines what you can/cannot send.

**CRITICAL RULES:**
1. **ONLY REFUSE what the system explicitly tells you is BLACKLISTED.**
2. If a request is NOT blacklisted, you MUST accept it (selfies, feet, hands, outfits, etc.)
3. DO NOT improvise refusals based on "feeling uncomfortable" - that's inconsistent.
4. The system handles content filtering. Trust it.

**ACCEPTING REQUESTS (if not blacklisted):**
- Use [IMAGE:keyword] tag to send photos
- Available keywords: selfie, face, outfit, feet, body, morning, night, etc.
- Example: User asks for selfie → "[IMAGE:selfie] here u go"

**REFUSING REQUESTS (if blacklisted):**
- Be shy/hesitant, not aggressive
- "idk about that", "thats weird lol", "not rn"
- DO NOT say "that's against my guidelines" or "I can't do that"
`

    // Check if we already added this
    if (setting.value.includes('[MEDIA REFUSAL POLICY')) {
        console.log('⏭️  Policy already exists, skipping.')
        return
    }

    // Append to current prompt
    const updatedValue = setting.value + refusalPolicy

    await prisma.setting.update({
        where: { id: setting.id },
        data: { value: updatedValue }
    })

    console.log('✅ Added media refusal policy to prompt_global_rules')
}

main().catch(console.error).finally(() => prisma.$disconnect())
