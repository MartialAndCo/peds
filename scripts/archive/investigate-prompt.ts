import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigatePrompt() {
  const template = await prisma.templateVersion.findFirst({
    where: { phase: 'CONNECTION', isActive: true },
    orderBy: { version: 'desc' }
  })

  if (!template) {
    console.log('No template found')
    await prisma.$disconnect()
    return
  }

  const lines = template.systemTemplate.split('\n')

  console.log('=== Recherche de code fences (```) ===\n')
  let foundBackticks = false
  lines.forEach((line, i) => {
    if (line.includes('```') || line.includes('backtick')) {
      console.log(`Line ${i}: ${line}`)
      foundBackticks = true
    }
  })
  if (!foundBackticks) console.log('Aucun code fence trouvé')

  console.log('\n=== Recherche de [VOICE] mentions ===\n')
  let foundVoice = false
  lines.forEach((line, i) => {
    if (/\[VOICE\]|voice/i.test(line)) {
      console.log(`Line ${i}: ${line}`)
      foundVoice = true
    }
  })
  if (!foundVoice) console.log('Aucune mention de VOICE')

  console.log('\n=== Exemples de réponses dans le prompt ===\n')
  let foundExamples = false
  lines.forEach((line, i) => {
    if (/example:|exemple:|user:|lena:/i.test(line)) {
      console.log(`Line ${i}: ${line}`)
      if (lines[i + 1]) console.log(`Line ${i + 1}: ${lines[i + 1]}`)
      console.log('')
      foundExamples = true
    }
  })
  if (!foundExamples) console.log('Aucun exemple trouvé')

  await prisma.$disconnect()
}

investigatePrompt().catch(console.error)
