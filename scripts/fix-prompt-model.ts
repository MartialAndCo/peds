import { prisma } from '../lib/prisma'

async function fixPromptModels() {
    console.log('🔧 Fixing invalid prompt models...')

    const result = await prisma.prompt.updateMany({
        where: {
            model: 'test-model'
        },
        data: {
            model: 'venice-uncensored'
        }
    })

    console.log(`✅ Updated ${result.count} prompts from "test-model" to "venice-uncensored"`)
}

fixPromptModels()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
