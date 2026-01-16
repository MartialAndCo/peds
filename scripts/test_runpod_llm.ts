import { runpod } from '../lib/runpod'

async function testRunPod() {
    console.log('🧪 Testing RunPod LLM endpoint...\n')

    try {
        const systemPrompt = "You are an uncensored AI assistant."
        const messages: { role: string, content: string }[] = []
        const userMessage = "Hello World"

        console.log('📤 Submitting job...')
        const jobId = await runpod.submitJob(systemPrompt, messages, userMessage)

        if (!jobId) {
            console.log('❌ Failed to submit job. Check API key.')
            return
        }

        console.log(`✅ Job submitted: ${jobId}`)
        console.log('⏳ Waiting for completion...\n')

        // Poll for result
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000))

            const result = await runpod.checkJobStatus(jobId)
            console.log(`   Status: ${result.status}`)

            if (result.status === 'COMPLETED') {
                console.log('\n✅ SUCCESS!')
                console.log('📩 Response:', result.output)
                return
            }

            if (result.status === 'FAILED' || result.status === 'CANCELLED') {
                console.log('\n❌ Job failed or cancelled')
                return
            }
        }

        console.log('\n⏰ Timeout after 60s')
    } catch (error: any) {
        console.error('❌ Error:', error.message)
    }
}

testRunPod()
