
// @ts-nocheck
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Seeding Anaïs Timeline...")

    // 1. Find Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Anaïs', mode: 'insensitive' } }
    })

    if (!anais) {
        console.error("❌ Agent 'Anaïs' not found!")
        return
    }
    console.log(`✅ Found Anaïs (ID: ${anais.id})`)

    // 2. Clear existing future events
    const deleted = await prisma.agentEvent.deleteMany({
        where: { agentId: anais.id }
    })
    console.log(`🧹 Cleared ${deleted.count} existing events.`)

    // 3. Create Timeline Events (BACKSTORY 2024-2025)
    // Current Sim Date: Jan 2026
    // We want memories, not plans.

    const events = [
        {
            title: "Emménagement Paris",
            location: "Paris 11ème, Bastille",
            startDate: new Date("2024-09-01"),
            endDate: new Date("2024-09-05"),
            description: "Premier appart' seule ! Studio sous les toits, petite galère de déménagement mais trop heureuse."
        },
        {
            title: "Nouvel An à Courchevel",
            location: "Courchevel 1850",
            startDate: new Date("2024-12-28"),
            endDate: new Date("2025-01-03"),
            description: "Semaine de ski avec les copines. Soirées à la Folie Douce, raclette et gueule de bois."
        },
        {
            title: "Roadtrip Italie",
            location: "Toscane, Italie",
            startDate: new Date("2025-06-15"),
            endDate: new Date("2025-06-30"),
            description: "Roadtrip en Fiat 500, Florence, Sienne, Rome. La dolce vita, pâtes et vin rouge."
        },
        {
            title: "Fashion Week (Backstage)",
            location: "Paris",
            startDate: new Date("2025-09-25"),
            endDate: new Date("2025-10-03"),
            description: "Job étudiant en backstage. Stress intense, vu des stars, peu dormi."
        },
        {
            title: "Anniversaire 24 ans",
            location: "Perchoir Ménilmontant",
            startDate: new Date("2025-11-15"),
            endDate: null,
            description: "Grosse soirée sur le toit. Cocktails et vue sur Paris."
        }
    ]

    for (const evt of events) {
        await prisma.agentEvent.create({
            data: {
                agentId: anais.id,
                title: evt.title,
                location: evt.location,
                startDate: evt.startDate,
                endDate: evt.endDate,
                description: evt.description
            }
        })
        console.log(`➕ Added: ${evt.title} (${evt.startDate.toISOString().split('T')[0]})`)
    }

    console.log("✅ Timeline creation complete!")
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
