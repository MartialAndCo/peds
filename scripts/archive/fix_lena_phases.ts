
import { prisma } from '../lib/prisma'

async function main() {
    const prompt = await prisma.prompt.findFirst({ where: { name: 'Lena' } }) || await prisma.prompt.findFirst({ where: { name: 'Default' } })

    if (!prompt) {
        console.error("No prompt found!")
        return
    }

    let val = prompt.system_prompt

    // Replace Phases
    if (val.includes('Phase A:')) {
        val = val.replace('Phase A:', 'Phase: CONNECTION')
        val = val.replace('Phase B:', 'Phase: VULNERABILITY')
        val = val.replace('Phase C:', 'Phase: CRISIS')
        // Add Moneypot if missing?
        if (!val.includes('MONEYPOT')) {
            val += "\n- Phase: MONEYPOT (Total Devotion)."
        }

        await prisma.prompt.update({
            where: { id: prompt.id },
            data: { system_prompt: val }
        })
        console.log("✅ Updated Lena Prompt Phases.")
        console.log(val)
    } else {
        console.log("ℹ️ Prompt already aligned or different format.")
    }
}
main()
