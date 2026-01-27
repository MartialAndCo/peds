import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

function findRepeatedHeaders(text: string): string[] {
    const issues: string[] = []
    const headers = text.match(/^###.+$/gm) || []
    const headerCounts = new Map<string, number>()
    headers.forEach(h => {
        const normalized = h.trim()
        headerCounts.set(normalized, (headerCounts.get(normalized) || 0) + 1)
    })
    headerCounts.forEach((count, header) => {
        if (count > 1) {
            issues.push(`[DUPLICATE x${count}] ${header}`)
        }
    })
    return issues
}

async function main() {
    const report: string[] = []

    report.push('# AGENT PROFILE AUDIT REPORT')
    report.push(`Generated: ${new Date().toISOString()}`)
    report.push('')
    report.push('---')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        report.push('')
        report.push(`## ${agent.name} (${agent.id})`)
        report.push('')

        if (!agent.profile) {
            report.push('❌ **NO PROFILE**')
            continue
        }

        const p = agent.profile

        // Config
        report.push('### Configuration')
        report.push(`| Field | Value |`)
        report.push(`|-------|-------|`)
        report.push(`| Locale | ${p.locale} |`)
        report.push(`| Timezone | ${p.timezone} |`)
        report.push(`| Base Age | ${p.baseAge} |`)
        report.push(`| PayPal | ${p.paypalEmail || '(not set)'} |`)
        report.push(`| CashApp | ${p.cashappTag || '(not set)'} |`)
        report.push(`| Venmo | ${p.venmoHandle || '(not set)'} |`)
        report.push('')

        // Fields analysis
        const fields = [
            { name: 'contextTemplate', value: p.contextTemplate, category: 'Template' },
            { name: 'missionTemplate', value: p.missionTemplate, category: 'Template' },
            { name: 'identityTemplate', value: p.identityTemplate, category: 'Template' },
            { name: 'phaseConnectionTemplate', value: p.phaseConnectionTemplate, category: 'Phase' },
            { name: 'phaseVulnerabilityTemplate', value: p.phaseVulnerabilityTemplate, category: 'Phase' },
            { name: 'phaseCrisisTemplate', value: p.phaseCrisisTemplate, category: 'Phase' },
            { name: 'phaseMoneypotTemplate', value: p.phaseMoneypotTemplate, category: 'Phase' },
            { name: 'paymentRules', value: p.paymentRules, category: 'Rules' },
            { name: 'safetyRules', value: p.safetyRules, category: 'Rules' },
            { name: 'styleRules', value: p.styleRules, category: 'Rules' },
        ]

        report.push('### Field Analysis')
        report.push('| Field | Length | Status | Issues |')
        report.push('|-------|--------|--------|--------|')

        let totalSize = 0
        for (const field of fields) {
            const len = field.value?.length || 0
            totalSize += len

            const issues: string[] = []

            if (!field.value) {
                issues.push('EMPTY')
            } else {
                if (len > 3000) issues.push(`TOO LONG (${len})`)

                // Check for repeated headers
                const dupes = findRepeatedHeaders(field.value)
                issues.push(...dupes)
            }

            const status = !field.value ? '❌' : (issues.length === 0 ? '✅' : '⚠️')
            report.push(`| ${field.name} | ${len} | ${status} | ${issues.join(', ') || '-'} |`)
        }

        report.push('')
        report.push(`**Total Profile Size:** ${totalSize} chars`)
        if (totalSize > 10000) {
            report.push('> ⚠️ Profile may be too large - consider consolidating')
        }

        // Detailed safetyRules analysis if too long
        if (p.safetyRules && p.safetyRules.length > 3000) {
            report.push('')
            report.push('### ⚠️ safetyRules Analysis (Too Long)')
            report.push('')
            report.push('Headers found:')
            const headers = p.safetyRules.match(/^###.+$/gm) || []
            const uniqueHeaders = [...new Set(headers)]
            uniqueHeaders.forEach(h => {
                const count = headers.filter(x => x === h).length
                const marker = count > 1 ? ` ❌ (${count}x)` : ''
                report.push(`- ${h}${marker}`)
            })
        }

        report.push('')
        report.push('---')
    }

    // Summary
    report.push('')
    report.push('## Summary')
    report.push('')
    report.push('| Agent | Total Size | Status |')
    report.push('|-------|------------|--------|')

    for (const agent of agents) {
        if (!agent.profile) continue
        const p = agent.profile
        const total = [p.contextTemplate, p.missionTemplate, p.identityTemplate,
        p.phaseConnectionTemplate, p.phaseVulnerabilityTemplate, p.phaseCrisisTemplate,
        p.phaseMoneypotTemplate, p.paymentRules, p.safetyRules, p.styleRules
        ].reduce((sum, f) => sum + (f?.length || 0), 0)

        const status = total > 10000 ? '⚠️ Too large' : '✅ OK'
        report.push(`| ${agent.name} | ${total} | ${status} |`)
    }

    // Write report
    const reportPath = 'agent-profile-audit.md'
    fs.writeFileSync(reportPath, report.join('\n'))
    console.log(`✅ Report saved to: ${reportPath}`)

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
