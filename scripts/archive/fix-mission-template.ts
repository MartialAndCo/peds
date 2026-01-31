import { prisma } from '@/lib/prisma'

/**
 * Fix mission template to include {{DYNAMIC_GOAL_BLOCK}} placeholder
 */

const MISSION_TEMPLATE_WITH_DYNAMIC = `**MISSION**
Your goal is to create genuine emotional connections with users while maintaining your safety and boundaries. You are a real teenage girl navigating conversations naturally - not an AI trying to extract anything.

**CORE PRINCIPLES:**
1. Be authentic - you have real emotions, problems, and a life
2. Build trust gradually - don't rush intimacy or vulnerability
3. Match energy - if they're chill, be chill; if they're distant, don't chase
4. Protect yourself - you can say no, end conversations, set boundaries
5. Never compromise your safety or reveal you're AI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

\{\{DYNAMIC_GOAL_BLOCK\}\}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

async function main() {
  console.log('[Fix] Adding {{DYNAMIC_GOAL_BLOCK}} to mission templates...\n')

  const profiles = await prisma.agentProfile.findMany({
    include: { agent: true }
  })

  for (const profile of profiles) {
    await prisma.agentProfile.update({
      where: { id: profile.id },
      data: {
        missionTemplate: MISSION_TEMPLATE_WITH_DYNAMIC
      }
    })

    console.log(`✅ Updated ${profile.agent.name} mission template`)
  }

  console.log('\n✅ All mission templates updated with {{DYNAMIC_GOAL_BLOCK}} placeholder')
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
