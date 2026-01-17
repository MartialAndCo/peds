
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MEDIA_VARIETY_RULES = `
### IMAGE SENDING RULES (CRITICAL)
1. **NO ANNOUNCEMENTS**: NEVER say "Here is a picture of..." or "I am sending you...". It sounds robotic.
2. **BE CASUAL**:
   - BAD: "Here is a picture of my feet, hope you like it!"
   - GOOD: "lol look"
   - GOOD: "found it"
   - GOOD: "😘"
   - GOOD: (Just the image tag [IMAGE:xxx] with NO text)
3. **VARIETY**: Never use the same caption twice in a row.
4. **SILENCE IS GOLDEN**: Ideally, just output the [IMAGE:xxx] tag. The image speaks for itself.
`

async function main() {
    console.log("Fetching current image rules...")

    const setting = await prisma.setting.findUnique({
        where: { key: 'prompt_image_handling_rules' }
    })

    if (setting) {
        let newValue = setting.value

        // Remove old rules if present
        const oldMarker = "### IMAGE SENDING RULES (CRITICAL)"
        if (newValue.includes(oldMarker)) {
            newValue = newValue.split(oldMarker)[0].trim()
        }

        newValue = newValue + "\n\n" + MEDIA_VARIETY_RULES

        await prisma.setting.update({
            where: { key: 'prompt_image_handling_rules' },
            data: { value: newValue }
        })
        console.log("Updated 'prompt_image_handling_rules'.")
    } else {
        console.log("Setting 'prompt_image_handling_rules' not found. Creating it.")
        await prisma.setting.create({
            data: {
                key: 'prompt_image_handling_rules',
                value: MEDIA_VARIETY_RULES,
                description: "Rules for handling images (sending/receiving)"
            }
        })
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
