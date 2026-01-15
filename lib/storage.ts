
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing. Media upload will fail.')
}

export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null

export const storage = {
    async uploadMedia(buffer: Buffer, mimeType: string, folder: string = 'chat-media'): Promise<string | null> {
        if (!supabase) {
            console.error('[Storage] Supabase client not initialized')
            return null
        }

        try {
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
            const filename = `${folder}/${Date.now()}-${uuidv4()}.${ext}`

            const { error } = await supabase
                .storage
                .from('media') // Assuming 'media' bucket exists
                .upload(filename, buffer, {
                    contentType: mimeType,
                    upsert: false
                })

            if (error) {
                console.error('[Storage] Upload failed:', error)
                return null
            }

            // Get Public URL
            const { data } = supabase
                .storage
                .from('media')
                .getPublicUrl(filename)

            return data.publicUrl

        } catch (e) {
            console.error('[Storage] Unexpected error:', e)
            return null
        }
    }
}
