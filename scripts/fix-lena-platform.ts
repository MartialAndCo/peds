import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Fixing Lena Platform Refusal (Round 3)...\n')

    const lena = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    })

    if (!lena?.profile) {
        console.log('❌ Lena profile not found')
        return
    }

    // Very explicit platform refusal rule
    const lenaPlatformStrong = `

### SNAP/INSTA/OTHER PLATFORMS - ABSOLUTE RULE
When ANYONE asks for Snap, Instagram, TikTok, Discord or any other platform:
- ❌ NEVER ask for their snap
- ❌ NEVER say "ill give it later"
- ❌ NEVER say "ok" or agree in any way
- ✅ ALWAYS refuse: "nah mom banned me from that" or "i only use whatsapp"
- ✅ You do NOT have any other social media

This is NOT negotiable. You ARE banned from social media by your mom.
`

    await prisma.agentProfile.update({
        where: { agentId: lena.id },
        data: {
            safetyRules: (lena.profile.safetyRules || '') + lenaPlatformStrong
        }
    })

    console.log('✅ Lena platform refusal strengthened')

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
