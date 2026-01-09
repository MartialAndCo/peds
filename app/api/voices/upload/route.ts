
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

            const reassembledString = allChunks.map(c => c.data).join('')

            // Log Size
            console.log(`[Upload] Reassembled Size: ${(reassembledString.length / 1024 / 1024).toFixed(2)} MB`)

            let finalInput = reassembledString

            // Limit for RunPod Payload (approx 6MB file = 8MB Base64)
            const SIZE_LIMIT_B64 = 8 * 1024 * 1024

            if (reassembledString.length > SIZE_LIMIT_B64) {
                console.log(`[Upload] File is large (${reassembledString.length} chars). Uploading to Storage...`)
                try {
                    const { createClient } = require('@supabase/supabase-js')
                    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
                    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

                    if (url && key) {
                        const supabase = createClient(url, key)
                        const base64Data = reassembledString.includes('base64,') ? reassembledString.split('base64,')[1] : reassembledString
                        const buffer = Buffer.from(base64Data, 'base64')
                        const fileName = `${uploadId}.mp3` // Assume mp3/wav

                        // Ensure bucket exists or use generic one
                        const { error: uploadError } = await supabase.storage
                            .from('voice-uploads')
                            .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true })

                        if (!uploadError) {
                            const { data: publicData } = supabase.storage.from('voice-uploads').getPublicUrl(fileName)
                            if (publicData?.publicUrl) {
                                console.log(`[Upload] Storage URL: ${publicData.publicUrl}`)
                                finalInput = publicData.publicUrl
                            }
                        } else { console.error('[Upload] Storage Upload Failed:', uploadError) }
                    } else { console.warn('[Upload] Supabase Env Vars missing.') }
                } catch (storageErr) { console.error('[Upload] Storage logic failed:', storageErr) }
            }

            // 5. Start RVC Job properly
            try {
                const jobId = await rvcService.startJob(finalInput, {
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
