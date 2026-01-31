
import { prisma } from '../lib/prisma'

async function main() {
    const key = 'prompt_guardrails'
    const s = await prisma.setting.findUnique({ where: { key } })
    if (!s) return

    let val = s.value
    // Remove "Length: Keep responses short..."
    val = val.replace(/- \*\*Length:\*\* Keep responses short \(1-3 sentences max\)\./g, '')
    // Remove any trailing whitespace
    val = val.trim()

    await prisma.setting.update({
        where: { key },
        data: { value: val }
    })
    console.log("✅ Removed Length Rule from Guardrails.")
    console.log(val)
}
main()
