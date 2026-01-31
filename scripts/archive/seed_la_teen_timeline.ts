
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("🌱 Seeding LA Teen Timeline...")

    // 1. Find the target agent (Default to ID 1 or the first one found)
    const agent = await prisma.agent.findFirst({
        orderBy: { id: 'asc' }
    })

    if (!agent) {
        console.error("❌ No agent found. Create an agent first.")
        process.exit(1)
    }

    console.log(`👤 Targeted Agent: ${agent.name} (ID: ${agent.id})`)

    const events = [
        {
            title: "Back to School",
            location: "Santa Monica High School, Los Angeles",
            startDate: new Date("2025-09-02"), // Future relative to typical "now", but "last year" relative to implied persona time? 
            // User said "cette année l'année dernière" -> let's assume current year cycle 2024-2025 or 2025-2026. 
            // Let's use 2024-2025 to be safe as "past/current" events.
            // Actually, the user prompts usually imply we are creating *history*.
            // Let's use 2024 for "last year" and 2025 for "this year".

            // Re-reading: "cette année l'année dernière" -> "This year [and] last year".
            // Let's seed mostly 2024 and 2025.
        },
        // 2024
        {
            title: "Started Varsity Basketball",
            location: "Santa Monica High Gym",
            startDate: new Date("2024-11-10"),
            endDate: new Date("2025-03-15"),
            description: "Made the varsity team! Practices are every day after school."
        },
        {
            title: "Family Trip to Cabo",
            location: "Cabo San Lucas, Mexico",
            startDate: new Date("2024-12-20"),
            endDate: new Date("2024-12-30"),
            description: "Winter break with parents. Stayed at a resort. Lots of beach time."
        },

        // 2025
        {
            title: "District Finals (Basketball)",
            location: "Crypto.com Arena (Finals)",
            startDate: new Date("2025-02-14"),
            description: "We lost by 2 points but it was an amazing experience to play on the big court."
        },
        {
            title: "Spring Break Roadtrip",
            location: "Joshua Tree National Park",
            startDate: new Date("2025-04-05"),
            endDate: new Date("2025-04-10"),
            description: "Camping trip with the girls. Stargazing was unreal."
        },
        {
            title: "Summer in Europe",
            location: "Paris, France",
            startDate: new Date("2025-07-01"),
            endDate: new Date("2025-07-15"),
            description: "Visiting family in Europe. Shopping on Champs-Élysées."
        }
    ]

    console.log(`📅 Inserting ${events.length} events...`)

    // Clear existing for clean seed? Maybe optional.
    // await prisma.agentEvent.deleteMany({ where: { agentId: agent.id } })

    for (const evt of events) {
        await prisma.agentEvent.create({
            data: {
                agentId: agent.id,
                title: evt.title,
                location: evt.location,
                startDate: evt.startDate,
                endDate: evt.endDate,
                description: evt.description
            }
        })
    }

    console.log("✅ Timeline seeded successfully!")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
