
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const VOICE_MODELS = [
    { name: "uk 1", url: "https://huggingface.co/lyery/models-vc/resolve/main/p261.zip?download=true" },
    { name: "American 1", url: "https://huggingface.co/Razer112/Public_Models/resolve/main/ProbMelody.zip?download=true" },
    { name: "American 2", url: "https://huggingface.co/Razer112/Public_Models/resolve/main/Merely-wufeii.zip?download=true" },
    { name: "American 3", url: "https://huggingface.co/Razer112/Public_Models/resolve/main/Alexasmrtalks.zip?download=true" },
    { name: "Homer", url: "https://huggingface.co/Models/Homer/resolve/main/homer_simpson.zip" }
]

async function main() {
    console.log('Seeding Voice Models...')
    for (const model of VOICE_MODELS) {
        const existing = await prisma.voiceModel.findFirst({ where: { name: model.name } })
        if (!existing) {
            await prisma.voiceModel.create({ data: model })
            console.log(`Created: ${model.name}`)
        } else {
            console.log(`Exists: ${model.name}`)
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
