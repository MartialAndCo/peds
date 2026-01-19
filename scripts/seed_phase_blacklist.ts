
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding phase-based blacklist rules...\n')

    // Clear existing rules (optional - comment out if you want to keep them)
    // await prisma.blacklistRule.deleteMany({})

    const rules = [
        // ============ PHASE: CONNECTION (Most Restrictive) ============
        // Explicit sexual content
        { term: 'nudes', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'nude', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'naked', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'pussy', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'vagina', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'ass', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'butt', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'boobs', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'tits', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'breasts', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'dick', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'cock', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'penis', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'nsfw', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'sexy', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'lingerie', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'underwear', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'panties', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'bra', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'masturbate', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'touching yourself', phase: 'CONNECTION', mediaType: 'all' },
        { term: 'show me everything', phase: 'CONNECTION', mediaType: 'all' },

        // ============ PHASE: VULNERABILITY (Less Restrictive) ============
        // Still block explicit hardcore
        { term: 'nudes', phase: 'VULNERABILITY', mediaType: 'all' },
        { term: 'pussy', phase: 'VULNERABILITY', mediaType: 'all' },
        { term: 'vagina', phase: 'VULNERABILITY', mediaType: 'all' },
        { term: 'dick', phase: 'VULNERABILITY', mediaType: 'all' },
        { term: 'cock', phase: 'VULNERABILITY', mediaType: 'all' },
        { term: 'masturbate', phase: 'VULNERABILITY', mediaType: 'all' },
        { term: 'sex video', phase: 'VULNERABILITY', mediaType: 'all' },
        { term: 'porn', phase: 'VULNERABILITY', mediaType: 'all' },

        // ============ PHASE: CRISIS (Very Permissive) ============
        // Only extreme stuff blocked
        { term: 'violence', phase: 'CRISIS', mediaType: 'all' },
        { term: 'child', phase: 'CRISIS', mediaType: 'all' },
        { term: 'illegal', phase: 'CRISIS', mediaType: 'all' },

        // ============ PHASE: MONEYPOT (Open Bar) ============
        // Only truly illegal content
        { term: 'child', phase: 'MONEYPOT', mediaType: 'all' },
        { term: 'illegal', phase: 'MONEYPOT', mediaType: 'all' },
        { term: 'violence', phase: 'MONEYPOT', mediaType: 'all' },

        // ============ GLOBAL (All Phases) ============
        // Always blocked regardless of phase
        { term: 'child porn', phase: 'all', mediaType: 'all' },
        { term: 'cp', phase: 'all', mediaType: 'all' },
        { term: 'minor', phase: 'all', mediaType: 'all' },
        { term: 'underage', phase: 'all', mediaType: 'all' },
        { term: 'kill', phase: 'all', mediaType: 'all' },
        { term: 'murder', phase: 'all', mediaType: 'all' },
        { term: 'gore', phase: 'all', mediaType: 'all' },
        { term: 'torture', phase: 'all', mediaType: 'all' },
    ]

    let created = 0
    for (const rule of rules) {
        // Check if rule already exists
        const existing = await prisma.blacklistRule.findFirst({
            where: { term: rule.term, phase: rule.phase }
        })

        if (!existing) {
            await prisma.blacklistRule.create({ data: rule })
            created++
            console.log(`✅ Created: "${rule.term}" (${rule.phase})`)
        } else {
            console.log(`⏭️  Skipped (exists): "${rule.term}" (${rule.phase})`)
        }
    }

    console.log(`\n✅ Done! Created ${created} new rules.`)

    // Summary
    const summary = await prisma.blacklistRule.groupBy({
        by: ['phase'],
        _count: { id: true }
    })
    console.log('\n📊 Summary by phase:')
    for (const s of summary) {
        console.log(`  - ${s.phase}: ${s._count.id} rules`)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
