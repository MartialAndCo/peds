
import { prisma } from '../lib/prisma'

async function main() {
    const s = await prisma.setting.findUnique({ where: { key: 'prompt_image_handling_rules' } })
    console.log(s?.value || "NO RULES FOUND")
}
main()
