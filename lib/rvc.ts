
import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'


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
    async _getConfig(options: { agentId?: string, voiceId?: number, sourceGender?: string }) {
        // 1. Get Settings
        const settings = await settingsService.getSettings()

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
                if ((agent as any).voiceModel) {
                    selectedModel = (agent as any).voiceModel.name
                    modelUrl = (agent as any).voiceModel.url
                    targetGender = (agent as any).voiceModel.gender
                }
            }
        }

        // 3. Defaults & Custom Params
        let pitch = 0
        let indexRate = 0.75
        let protect = 0.33
        let rmsMixRate = 0.25
        let filterRadius = 3

        if (options.voiceId || options.agentId) {
            const voice = options.voiceId
                ? await prisma.voiceModel.findUnique({ where: { id: options.voiceId } })
                : (await prisma.agent.findUnique({ where: { id: options.agentId }, include: { voiceModel: true } }) as any)?.voiceModel

            if (voice) {
                indexRate = Number(voice.indexRate) || 0.75
                protect = Number(voice.protect) || 0.33
                rmsMixRate = Number(voice.rmsMixRate) || 0.25
                // @ts-ignore
                filterRadius = Number(voice.filterRadius) || 3
            }
        }

        // Gender-based pitch adjustment (remains as default logic)
        if (sourceGender === 'MALE' && targetGender === 'FEMALE') {
            pitch = 12
        } else if (sourceGender === 'FEMALE' && targetGender === 'MALE') {
            pitch = -12
        }

        if (!modelUrl) {
            selectedModel = "American 1"
            modelUrl = "https://huggingface.co/Razer112/Public_Models/resolve/main/ProbMelody.zip?download=true"
        }

        const rvcUrl = process.env.RVC_API_URL || settings.rvc_api_url || process.env.LIGHTNING_API_URL || settings.lightning_api_url || 'http://localhost:8000'
        const runpodKey = process.env.RUNPOD_API_KEY || settings.runpod_api_key

        return { rvcUrl, runpodKey, selectedModel, modelUrl, pitch, indexRate, protect, rmsMixRate, filterRadius }
    },

    /**
     * Starts an Async RVC Job (RunPod Only)
     */
    async startJob(audioInput: string, options: { agentId?: string, voiceId?: number, sourceGender?: string }) {
        const config = await this._getConfig(options)

        console.log(`[RVC-Async] Config resolved: rvcUrl=${config.rvcUrl}, model=${config.selectedModel}, pitch=${config.pitch}`)

        if (!config.runpodKey) {
            console.error('[RVC-Async] CRITICAL: No RunPod API Key configured!')
            return null
        }

        let payload: any = {
            input: {
                model_name: config.selectedModel,
                model_url: config.modelUrl,
                pitch: config.pitch,
                f0_method: 'rmvpe',
                index_rate: config.indexRate,
                protect: config.protect,
                rms_mix_rate: config.rmsMixRate,
                filter_radius: config.filterRadius
            }
        }

        // Guard: Ensure audioInput is a string
        let cleanBase64 = ""
        if (typeof audioInput !== 'string') {
            console.warn(`[RVC-Async] Warning: audioInput is not a string (Type: ${typeof audioInput}). Checking object structure...`)

            if (Buffer.isBuffer(audioInput)) {
                cleanBase64 = (audioInput as Buffer).toString('base64')
                console.log(`[RVC-Async] Converted Buffer to Base64 (length: ${cleanBase64.length})`)
            } else if (typeof audioInput === 'object' && audioInput !== null) {
                // Handle various object structures
                const inputObj = audioInput as any

                if (inputObj.type === 'Buffer' && Array.isArray(inputObj.data)) {
                    // JSON-serialized Buffer: { type: 'Buffer', data: [...] }
                    cleanBase64 = Buffer.from(inputObj.data).toString('base64')
                    console.log(`[RVC-Async] Converted JSON Buffer to Base64 (length: ${cleanBase64.length})`)
                } else if (inputObj.data && Array.isArray(inputObj.data)) {
                    // Sometimes just { data: [...] }
                    cleanBase64 = Buffer.from(inputObj.data).toString('base64')
                    console.log(`[RVC-Async] Converted Generic Data Array to Base64 (length: ${cleanBase64.length})`)
                } else if (inputObj.data && typeof inputObj.data === 'string') {
                    // Handle { mimetype, data } where data is already a base64 string
                    cleanBase64 = inputObj.data
                    if (cleanBase64.includes('base64,')) cleanBase64 = cleanBase64.split('base64,')[1]
                    console.log(`[RVC-Async] Extracted Base64 from data property (length: ${cleanBase64.length})`)
                } else {
                    console.error(`[RVC-Async] FATAL: Unknown object structure: keys=[${Object.keys(inputObj).join(', ')}]`)
                    return null
                }
            } else {
                console.error(`[RVC-Async] FATAL: Invalid audioInput type: ${typeof audioInput}`)
                return null
            }
        } else {
            // Check if input is URL or Base64
            if (audioInput.startsWith('http://') || audioInput.startsWith('https://')) {
                console.log(`[RVC] Using Audio URL: ${audioInput}`)
                payload.input.audio_url = audioInput
                // Early exit for URL flow
            } else {
                // Handle Base64 String
                cleanBase64 = audioInput
                if (audioInput.includes('base64,')) cleanBase64 = audioInput.split('base64,')[1]
                console.log(`[RVC] Using Base64 input (length: ${cleanBase64.length})`)
            }
        }

        // Assign audio_base64 if not using URL
        if (!payload.input.audio_url && cleanBase64) {
            payload.input.audio_base64 = cleanBase64
        }

        // Add Webhook (Dynamic based on Environment)
        const appUrl = process.env.WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://peds.ngrok.io'; // Fallback for dev
        if (appUrl && appUrl.startsWith('http')) {
            payload.webhook = `${appUrl}/api/webhooks/runpod`;
            console.log(`[RVC-Async] Added Webhook: ${payload.webhook}`);
        }


        // Use /run endpoint
        let endpoint = config.rvcUrl
        if (!endpoint.includes('/run') && !endpoint.includes('/submit')) {
            // If it ends with /runsync, strip it
            endpoint = endpoint.replace(/\/runsync$/, '')
            endpoint = `${endpoint.replace(/\/$/, '')}/run`
        }

        console.log(`[RVC-Async] Starting Job at ${endpoint}...`)

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.runpodKey}`
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error body')
                console.error(`[RVC-Async] Job start FAILED. Status: ${response.status}, Body: ${errorText}`)
                return null
            }

            const data = await response.json()
            console.log(`[RVC-Async] Job started successfully. Job ID: ${data.id}`)
            return data.id // Returns the Job ID
        } catch (fetchErr: any) {
            console.error(`[RVC-Async] Fetch error: ${fetchErr.message}`)
            return null
        }
    },

    /**
     * Checks the status of a RunPod Job
     */
    async checkJob(jobId: string) {
        // We need the API Key/URL again. Ideally we store this or fetch it.
        // For simplicity, we re-fetch settings.
        const settings = await settingsService.getSettings()
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
    async convertVoice(audioBase64: string, options: { agentId?: string, voiceId?: number, sourceGender?: string } = {}): Promise<string | null> {
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
