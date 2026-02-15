
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.warn('[Storage] ⚠️ Supabase credentials missing. Media upload will fall back to base64.')
}

export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null

// Ordered list of buckets to try (most specific → most general)
const UPLOAD_BUCKETS = ['media-uploads', 'media', 'voice-uploads'] as const

export const storage = {
    async uploadMedia(buffer: Buffer, mimeType: string, folder: string = 'chat-media'): Promise<string | null> {
        if (!supabase) {
            console.error('[Storage] Supabase client not initialized — falling back to base64')
            return `data:${mimeType};base64,${buffer.toString('base64')}`
        }

        const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
        const filename = `${folder}/${Date.now()}-${uuidv4()}.${ext}`
        console.log(`[Storage] Uploading ${buffer.length} bytes (${mimeType}) as ${filename}`)

        // Try each bucket in order
        for (const bucket of UPLOAD_BUCKETS) {
            try {
                const { error } = await supabase
                    .storage
                    .from(bucket)
                    .upload(filename, buffer, {
                        contentType: mimeType,
                        upsert: true
                    })

                if (error) {
                    console.warn(`[Storage] Upload to '${bucket}' failed:`, error.message)
                    continue
                }

                const { data } = supabase
                    .storage
                    .from(bucket)
                    .getPublicUrl(filename)

                if (data?.publicUrl) {
                    console.log(`[Storage] ✅ Upload SUCCESS to '${bucket}': ${data.publicUrl}`)
                    return data.publicUrl
                }
            } catch (e: any) {
                console.warn(`[Storage] Exception on '${bucket}':`, e.message)
                continue
            }
        }

        // All buckets failed — fallback to base64 data URI so the photo is never lost
        console.error('[Storage] ❌ All bucket uploads failed. Saving as base64 data URI.')
        return `data:${mimeType};base64,${buffer.toString('base64')}`
    }
}

