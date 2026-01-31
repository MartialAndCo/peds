import { prisma } from '@/lib/prisma'
import { director } from '@/lib/director'

async function main() {
  const agent = await prisma.agent.findFirst({
    where: { name: 'Lena' },
    include: { profile: true }
  })

  const contact = await prisma.contact.findFirst({
    where: { phone_whatsapp: { contains: 'test-phase4' } }
  })

  if (!agent || !contact) {
    console.error('Agent or contact not found')
    process.exit(1)
  }

  const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)

  const prompt = await director.buildSystemPrompt(
    { venice_api_key: 'test' },
    contact,
    phase,
    details,
    'You are Lena',
    agent.id,
    'VIP/Financial Relationship Established'
  )

  // Find Phase 4 section
  const phase4Start = prompt.indexOf('**PHASE 4')
  const phase4Start2 = prompt.indexOf('PHASE 4')
  const phase4Start3 = prompt.indexOf('MONEYPOT')

  console.log(`Searching for Phase 4 markers:`)
  console.log(`  "**PHASE 4" found at: ${phase4Start}`)
  console.log(`  "PHASE 4" found at: ${phase4Start2}`)
  console.log(`  "MONEYPOT" found at: ${phase4Start3}`)
  console.log()

  if (phase4Start3 !== -1) {
    const phase4Section = prompt.substring(Math.max(0, phase4Start3 - 50), phase4Start3 + 1000)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('PHASE 4 PROMPT SECTION (Around MONEYPOT)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(phase4Section)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } else {
    console.log('⚠️  Phase 4 section not found in prompt')
    console.log('\nFull prompt length:', prompt.length)
    console.log('First 500 chars of prompt:')
    console.log(prompt.substring(0, 500))
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
