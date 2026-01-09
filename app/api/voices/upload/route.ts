
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rvcService } from '@/lib/rvc'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    // 1. Auth Check
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Parse Chunk Info
    try {
        const body = await req.json()
        const { uploadId, index, total, chunk, voiceId, sourceGender } = body

        if (!uploadId || index === undefined || !total || !chunk) {
            return NextResponse.json({ error: 'Missing chunks parameters' }, { status: 400 })
        }

        // 3. Store Chunk
        await prisma.voiceUploadChunk.create({
            data: {
                uploadId,
                index,
                total,
                data: chunk
            }
        })

        // 4. Check if we have all chunks
        const count = await prisma.voiceUploadChunk.count({
            where: { uploadId }
        })

        if (count >= total) {
            console.log(`[Upload] All ${total} chunks received for ${uploadId}. Reassembling...`)

            // Reassemble
            const allChunks = await prisma.voiceUploadChunk.findMany({
                where: { uploadId },
                orderBy: { index: 'asc' }
            })

            const fullBase64 = allChunks.map(c => c.data).join('')

            // Log Size
            console.log(`[Upload] Reassembled Size: ${(fullBase64.length / 1024 / 1024).toFixed(2)} MB`)

            // 5. Start RVC Job properly
            // We reuse the logic from /api/voices/test but server-side

            try {
                // Call RVC Service directly 
                // Note: startJob creates the 'VoiceGeneration' record logic needs to be handled
                // wait, startJob returns jobId. WE need to create the record here or RVC service does it?
                // rvcService.startJob() ONLY calls RunPod.
                // We need to create the VoiceGeneration record here.

                const jobId = await rvcService.startJob(fullBase64, {
                    voiceId: parseInt(voiceId),
                    sourceGender
                })

                if (!jobId) {
                    throw new Error('Failed to start RunPod job')
                }

                // Create DB Record
                const generation = await prisma.voiceGeneration.create({
                    data: {
                        voiceModelId: parseInt(voiceId),
                        status: 'PENDING',
                        jobId: jobId
                    }
                })

                // Cleanup Chunks (Async)
                prisma.voiceUploadChunk.deleteMany({ where: { uploadId } }).catch(console.error)

                return NextResponse.json({ success: true, generationId: generation.id, jobId })

            } catch (jobErr: any) {
                console.error('[Upload] Job Start Failed:', jobErr)
                // Cleanup
                prisma.voiceUploadChunk.deleteMany({ where: { uploadId } }).catch(console.error)
                return NextResponse.json({ error: jobErr.message || 'Job Failed' }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, part: index + 1 })

    } catch (e: any) {
        console.error('[Upload] Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
