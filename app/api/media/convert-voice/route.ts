import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'

const execAsync = promisify(exec)

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Make sure it's an audio or video file
        if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
            return NextResponse.json({ error: 'Invalid file type. Please upload an audio file.' }, { status: 400 })
        }

        // Read file contents
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Create temp paths
        const tmpDir = os.tmpdir()
        const inputId = uuidv4()
        const inputPath = path.join(tmpDir, `input_${inputId}`)
        const outputPath = path.join(tmpDir, `output_${inputId}.ogg`)

        try {
            // Write input to temp file
            await fs.writeFile(inputPath, buffer)

            // Convert to OGG OPUS using ffmpeg
            // This is the optimal format for WhatsApp PTT (Voice Notes)
            await execAsync(`ffmpeg -i "${inputPath}" -c:a libopus -b:a 32k -vbr on -compression_level 10 -frame_duration 20 -application voip "${outputPath}"`)

            // Read the converted file
            const outputBuffer = await fs.readFile(outputPath)
            const base64Audio = outputBuffer.toString('base64')
            const dataUri = `data:audio/ogg;base64,${base64Audio}`

            // Clean up
            await fs.unlink(inputPath).catch(console.error)
            await fs.unlink(outputPath).catch(console.error)

            return NextResponse.json({ 
                success: true, 
                audioBase64: dataUri,
                filename: file.name
            })
        } catch (error: any) {
            console.error('[ConvertVoice] FFmpeg conversion failed:', error)
            
            // Clean up on error
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            
            return NextResponse.json({ error: `Conversion failed: ${error.message}` }, { status: 500 })
        }
    } catch (error: any) {
        console.error('[ConvertVoice] Request handling failed:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
