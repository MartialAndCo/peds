import { PrismaClient } from '@prisma/client'
import { settingsService } from '../lib/settings-cache'

const prisma = new PrismaClient()

// Ensure settings are loaded
await settingsService.getSettings()

async function findPhotoSpamSource() {
  console.log('🔍 Searching for IMAGE spam instructions in templates...\n')

  const templates = await prisma.templateVersion.findMany({
    where: { isActive: true },
    orderBy: { phase: 'asc' }
  })

  for (const template of templates) {
    console.log('='.repeat(80))
    console.log(`PHASE: ${template.phase} (v${template.version})`)
    console.log('='.repeat(80))

    // Check for IMAGE tag instructions
    const imageMatches = template.systemTemplate.match(/\[IMAGE[^\]]*\][^\n]*/gi)
    if (imageMatches) {
      console.log('\n🚨 IMAGE TAG INSTRUCTIONS FOUND:')
      imageMatches.forEach(m => console.log('   ', m))
    }

    // Check for photo/selfie/mirror mentions
    const lines = template.systemTemplate.split('\n')
    const photoLines = lines.filter(line =>
      /image|photo|selfie|mirror|picture|pic/i.test(line) &&
      line.trim().length > 0
    )

    if (photoLines.length > 0) {
      console.log('\n📸 PHOTO-RELATED LINES:')
      photoLines.forEach((line, idx) => {
        if (idx < 20) { // Limit to first 20
          console.log(`   ${line.trim()}`)
        }
      })
      if (photoLines.length > 20) {
        console.log(`   ... and ${photoLines.length - 20} more lines`)
      }
    }

    // Check for "always" or "every message" patterns
    const alwaysPattern = lines.filter(line =>
      /always|every message|each message|all.*message/i.test(line) &&
      /image|photo|selfie|mirror/i.test(line)
    )

    if (alwaysPattern.length > 0) {
      console.log('\n⚠️ "ALWAYS SEND" PATTERNS DETECTED:')
      alwaysPattern.forEach(line => console.log('   ❌', line.trim()))
    }

    console.log('\n')
  }

  await prisma.$disconnect()
}

findPhotoSpamSource().catch(console.error)
