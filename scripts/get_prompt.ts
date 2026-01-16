import { prisma } from '../lib/prisma'

async function main() {
    const p = await prisma.prompt.findFirst({ where: { name: 'Lena' } })
    console.log("=== FULL LENA PROMPT ===")
    console.log(p?.system_prompt)
    await prisma.$disconnect()
}

main()
