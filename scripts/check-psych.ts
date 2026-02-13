import { prisma } from '@/lib/prisma'

async function main() {
    const psych = await prisma.contactPsychology.findFirst({
        orderBy: { updatedAt: 'desc' }
    })

    if (!psych) {
        console.log('Pas de psychologie')
        return
    }

    console.log('=== BIG FIVE STOCKÉS ===')
    console.log('Openness:', psych.openness)
    console.log('Conscientiousness:', psych.conscientiousness)
    console.log('Extraversion:', psych.extraversion)
    console.log('Agreeableness:', psych.agreeableness)
    console.log('Neuroticism:', psych.neuroticism)
    console.log('Red flags:', psych.redFlags)
    console.log('Vulnérabilités:', psych.vulnerabilities)
}

main()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1) })
