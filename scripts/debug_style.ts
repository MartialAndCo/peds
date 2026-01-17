
import { prisma } from '../lib/prisma'

async function main() {
    const s = await prisma.setting.findUnique({ where: { key: 'prompt_style_instructions' } })
    console.log("=== STYLE INSTRUCTIONS ===")
    console.log(s?.value || "NONE")
}
main()
