
import { prisma } from '@/lib/prisma'



export const rvcService = {
    /**
     * Converts a voice note using the Lightning AI RVC server.
     * @param audioBase64 The input audio in Base64 format (with or without data prefix).
     * @param agentId The ID of the agent to use the voice of.
     * @returns The converted audio in Base64 format.
     */
    async convertVoice(audioBase64: string, agentId?: number): Promise<string | null> {
        // 1. Get Settings & Agent Voice
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // Fetch Agent's assigned Voice Model
        let selectedModel = "default"
        let modelUrl = ""

        if (agentId) {
            const agent = await prisma.agent.findUnique({
                where: { id: agentId },
                include: { voiceModel: true }
            })

            if (agent?.voiceModel) {
                selectedModel = agent.voiceModel.name
                modelUrl = agent.voiceModel.url
            } else {
                console.warn(`[RVC] Agent ${agentId} has no VoiceModel assigned.Using default/fallback.`)
            }
        }

        // Fallback or System Default if Agent has no voice? 
        // For now, if no URL is found, we might want to default to something or let RunPod handle it (if logic exists there).
        // But user provided list implies we should probably be stricter.
        if (!modelUrl) {
            // Check if there is a default voice model in DB?
            // Or use a hardcoded fallback just in case to prevent crash
            console.warn('[RVC] No model URL found. Using fallback American 1.')
            selectedModel = "American 1"
            modelUrl = "https://huggingface.co/Razer112/Public_Models/resolve/main/ProbMelody.zip?download=true"
        }

        const rvcUrl = process.env.RVC_API_URL || settings.rvc_api_url || process.env.LIGHTNING_API_URL || settings.lightning_api_url || 'http://localhost:8000'

        // Ensure clean base64
        let cleanBase64 = audioBase64
        if (audioBase64.includes('base64,')) {
            cleanBase64 = audioBase64.split('base64,')[1]
        }

        console.log(`[RVC] Connecting to ${rvcUrl} for voice conversion (Agent: ${agentId}, Model: ${selectedModel})...`)

        try {
            // Check if we are using RunPod Serverless (URL contains runpod.ai)
            const isRunPodServerless = rvcUrl.includes('runpod.ai')

            if (isRunPodServerless) {
                // --- RunPod Serverless (Strict JSON Schema with Model URL) ---

                const payload = {
                    input: {
                        audio_base64: cleanBase64,
                        model_name: selectedModel,
                        model_url: modelUrl,
                        pitch: settings.rvc_f0_up_key ? parseInt(settings.rvc_f0_up_key) : 0,
                    }
                }

                // Append /runsync if needed
                let endpoint = rvcUrl
                if (!endpoint.includes('/run') && !endpoint.includes('/submit')) {
                    endpoint = `${endpoint.replace(/\/$/, '')}/runsync`
                }

                console.log(`[RVC] Sending JSON payload to RunPod Serverless: ${endpoint}`)

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY || settings.runpod_api_key}`
                    },
                    body: JSON.stringify(payload)
                })

                if (!response.ok) {
                    const errText = await response.text()
                    console.error(`[RVC] RunPod API Request failed: ${response.status} - ${errText}`)
                    return null
                }

                const data = await response.json()

                // RunPod Output: { output: { audio_base64: "..." } }
                if (data.status === 'COMPLETED' && data.output && data.output.audio_base64) {
                    return `data:audio/mpeg;base64,${data.output.audio_base64}`
                } else if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
                    console.error('[RVC] RunPod job timed out or is async. Status:', data.status)
                    return null
                } else {
                    console.error('[RVC] RunPod Error or unexpected response:', data)
                    return null
                }

            } else {
                // Classic FastAPI Server handling... unchanged
                const buffer = Buffer.from(cleanBase64, 'base64')
                const blob = new Blob([buffer], { type: 'audio/ogg' })

                const formData = new FormData()
                formData.append('file', blob, 'input.ogg')
                if (selectedModel) formData.append('model_name', selectedModel)

                const response = await fetch(`${rvcUrl}/convert`, {
                    method: 'POST',
                    body: formData
                })

                if (!response.ok) {
                    const errText = await response.text()
                    console.error(`[RVC] Conversion failed: ${response.status} - ${errText}`)
                    return null
                }

                const arrayBuffer = await response.arrayBuffer()
                const outputBuffer = Buffer.from(arrayBuffer)
                const outputBase64 = outputBuffer.toString('base64')
                return `data:audio/mpeg;base64,${outputBase64}`
            }

        } catch (error) {
            console.error('[RVC] Network/Processing Error:', error)
            return null
        }
    }
}
