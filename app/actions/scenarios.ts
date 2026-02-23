"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// Create Scenario
const createScenarioSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    targetContext: z.string().optional()
})

export async function createScenario(data: z.infer<typeof createScenarioSchema>) {
    try {
        const validatedData = createScenarioSchema.parse(data)

        const scenario = await prisma.scenario.create({
            data: {
                title: validatedData.title,
                description: validatedData.description,
                targetContext: validatedData.targetContext
            }
        })

        revalidatePath('/admin/scenarios')
        return { success: true, scenarioId: scenario.id }
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to create scenario" }
    }
}

// Delete Scenario
export async function deleteScenario(id: string) {
    try {
        await prisma.scenario.delete({
            where: { id }
        })

        revalidatePath('/admin/scenarios')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to delete scenario" }
    }
}

// Update Scenario
export async function updateScenario(id: string, data: Partial<z.infer<typeof createScenarioSchema>>) {
    try {
        await prisma.scenario.update({
            where: { id },
            data
        })

        revalidatePath('/admin/scenarios')
        revalidatePath(`/admin/scenarios/${id}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to update scenario" }
    }
}

// Add Scenario Media
export async function addScenarioMedia(scenarioId: string, bucketPath: string, mediaType: string, aiDescription: string) {
    try {
        await prisma.scenarioMedia.create({
            data: {
                scenarioId,
                bucketPath,
                mediaType,
                aiDescription
            }
        })

        revalidatePath(`/admin/scenarios/${scenarioId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to add scenario media" }
    }
}

// Delete Scenario Media
export async function deleteScenarioMedia(id: string, scenarioId: string) {
    try {
        await prisma.scenarioMedia.delete({
            where: { id }
        })

        revalidatePath(`/admin/scenarios/${scenarioId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to delete scenario media" }
    }
}

// Launch Scenario
export async function launchScenario(scenarioId: string, contactId: string, startTime: Date) {
    try {
        // Find existing to prevent duplicates if running?
        const existing = await prisma.activeScenario.findFirst({
            where: {
                scenarioId,
                contactId,
                status: { in: ['PENDING', 'RUNNING'] }
            }
        })

        if (existing) {
            return { success: false, error: "This scenario is already scheduled or running for this contact." }
        }

        await prisma.activeScenario.create({
            data: {
                scenarioId,
                contactId,
                startTime,
                status: 'PENDING'
            }
        })

        revalidatePath('/admin/scenarios')
        revalidatePath(`/admin/scenarios/${scenarioId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to schedule scenario" }
    }
}
