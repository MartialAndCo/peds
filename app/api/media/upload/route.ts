import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// Increase body size limit for this route
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '50mb',
        },
    },
}

// For App Router (Next.js 13+)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds timeout

export async function POST(req: Request) {
    // 1. Auth Check
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 2. Parse FormData
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // 3. Upload to Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'mp3'
        const fileName = `voice_samples/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

        // Upload to voice-uploads bucket
        const { error: uploadError } = await supabase.storage
            .from('voice-uploads')
            .upload(fileName, buffer, {
                contentType: file.type || 'audio/mpeg',
                upsert: false
            })

        if (uploadError) {
            console.error('Supabase upload error:', uploadError)
            return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
        }

        // Get public URL
        const { data } = supabase.storage
            .from('voice-uploads')
            .getPublicUrl(fileName)

        if (!data?.publicUrl) {
            return NextResponse.json({ error: 'Failed to get public URL' }, { status: 500 })
        }

        return NextResponse.json({ url: data.publicUrl })

    } catch (error: any) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
    }
}
