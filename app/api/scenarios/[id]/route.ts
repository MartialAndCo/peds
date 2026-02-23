import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: scenarioId } = await context.params

        const scenario = await prisma.scenario.findUnique({
            where: { id: scenarioId }
        })

        if (!scenario) {
            return NextResponse.json({ error: "Scenario not found" }, { status: 404 })
        }

        const media = await prisma.scenarioMedia.findMany({
            where: { scenarioId },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({ scenario, media })
    } catch (error: any) {
        console.error('Error fetching scenario:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
