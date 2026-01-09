
import { prisma } from '@/lib/prisma'



export const rvcService = {
    /**
     * Converts a voice note using the Lightning AI RVC server.
     * @param audioBase64 The input audio in Base64 format (with or without data prefix).
     * @param agentId The ID of the agent to use the voice of.
     * @returns The converted audio in Base64 format.
     */
    /**
     * Internal helper to determine RVC parameters (Source/Target/Pitch)
     */
    async _getConfig(options: { agentId?: number, voiceId?: number, sourceGender?: string }) {
        // 1. Get Settings
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // 2. Determine Genders
        let sourceGender = options.sourceGender || 'MALE'
        let targetGender = 'FEMALE'
        let selectedModel = "default"
        let modelUrl = ""

        if (options.voiceId) {
            const voice = await prisma.voiceModel.findUnique({ where: { id: options.voiceId } })
            if (voice) {
                selectedModel = voice.name
                modelUrl = voice.url
                targetGender = voice.gender
            }
        } else if (options.agentId) {
            const agent = await prisma.agent.findUnique({
                where: { id: options.agentId },
                include: { voiceModel: true }
            })
            if (agent) {
                if (agent.operatorGender) sourceGender = agent.operatorGender
                if (agent.voiceModel) {
                    selectedModel = agent.voiceModel.name
                    modelUrl = agent.voiceModel.url
                    targetGender = agent.voiceModel.gender
                }
            }
        }

        // 3. Rule Book
        let pitch = 0
        let indexRate = 0.75
        let protect = 0.33

        if (sourceGender === 'MALE' && targetGender === 'FEMALE') {
            pitch = 12
            indexRate = 0.8; protect = 0.40
        } else if (sourceGender === 'FEMALE' && targetGender === 'MALE') {
            pitch = -12
            indexRate = 0.8; protect = 0.40
        }

        if (!modelUrl) {
            selectedModel = "American 1"
            modelUrl = "https://huggingface.co/Razer112/Public_Models/resolve/main/ProbMelody.zip?download=true"
        }

        const rvcUrl = process.env.RVC_API_URL || settings.rvc_api_url || process.env.LIGHTNING_API_URL || settings.lightning_api_url || 'http://localhost:8000'
        const runpodKey = process.env.RUNPOD_API_KEY || settings.runpod_api_key

        return { rvcUrl, runpodKey, selectedModel, modelUrl, pitch, indexRate, protect }
    },

    /**
     * Starts an Async RVC Job (RunPod Only)
     */
    async startJob(audioBase64: string, options: { agentId?: number, voiceId?: number, sourceGender?: string }) {
        const config = await this._getConfig(options)

        let cleanBase64 = audioBase64
        if (audioBase64.includes('base64,')) cleanBase64 = audioBase64.split('base64,')[1]

        const payload = {
            input: {
                audio_base64: cleanBase64,
                model_name: config.selectedModel,
                model_url: config.modelUrl,
                pitch: config.pitch,
                f0_method: 'rmvpe', // Use RMVPE as requested
                index_rate: config.indexRate,
                protect: config.protect,
                filter_radius: 3
            }
        }

        // Use /run endpoint
        let endpoint = config.rvcUrl
        if (!endpoint.includes('/run') && !endpoint.includes('/submit')) {
            // If it ends with /runsync, strip it
            endpoint = endpoint.replace(/\/runsync$/, '')
            endpoint = `${endpoint.replace(/\/$/, '')}/run`
        }

        console.log(`[RVC-Async] Starting Job at ${endpoint}...`)

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.runpodKey}`
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) return null
        const data = await response.json()
        return data.id // Returns the Job ID
    },

    /**
     * Checks the status of a RunPod Job
     */
    async checkJob(jobId: string) {
        // We need the API Key/URL again. Ideally we store this or fetch it.
        // For simplicity, we re-fetch settings.
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc }, {})
        const rvcUrl = process.env.RVC_API_URL || settings.rvc_api_url
        const runpodKey = process.env.RUNPOD_API_KEY || settings.runpod_api_key

        // Endpoint: /status/{id}
        // Base URL assumption: https://api.runpod.ai/v2/{endpoint_id}
        // But our rvcUrl might be the full endpoint like https://api.runpod.ai/v2/{id}/runsync
        // We need to construct https://api.runpod.ai/v2/{id}/status/{jobId}

        // Clean URL
        let baseUrl = rvcUrl.replace(/\/runsync$/, '').replace(/\/run$/, '').replace(/\/$/, '')
        const statusUrl = `${baseUrl}/status/${jobId}`

        const response = await fetch(statusUrl, {
            headers: { 'Authorization': `Bearer ${runpodKey}` }
        })

        if (!response.ok) return { status: 'FAILED' }
        const data = await response.json()
        return data // { status: "COMPLETED", output: { ... } }
    },

    /**
     * Legacy Sync Conversion (Now wraps Async Job)
     */
    async convertVoice(audioBase64: string, options: { agentId?: number, voiceId?: number, sourceGender?: string } = {}): Promise<string | null> {
        console.log(`[RVC-SyncWrapper] Starting async job as sync replacement...`)

        // 1. Start the Job
        const jobId = await this.startJob(audioBase64, options)

        if (!jobId) {
            console.error('[RVC-SyncWrapper] Failed to start job.')
            return null
        }

        console.log(`[RVC-SyncWrapper] Job ${jobId} started. Polling for results...`)

        // 2. Poll until completion
        // Max wait: 5 minutes (RunPod cold starts can be long)
        const MAX_ATTEMPTS = 100
        const DELAY_MS = 3000

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await new Promise(r => setTimeout(r, DELAY_MS))

            const check = await this.checkJob(jobId)

            if (check.status === 'COMPLETED' && check.output?.audio_base64) {
                console.log(`[RVC-SyncWrapper] Job ${jobId} completed successfully!`)
                return `data:audio/mpeg;base64,${check.output.audio_base64}`
            }
            else if (check.status === 'FAILED' || check.status === 'TIMED_OUT' || check.status === 'error') {
                console.error(`[RVC-SyncWrapper] Job ${jobId} failed with status: ${check.status}`)
                return null
            }

            if (i % 10 === 0) console.log(`[RVC-SyncWrapper] Still waiting... (${i}/${MAX_ATTEMPTS})`)
        }

        console.error(`[RVC-SyncWrapper] Job ${jobId} timed out after max attempts.`)
        return null
    }
}
