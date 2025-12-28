
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Only run in Node.js environment (server), not edge or browser
        console.log('[Instrumentation] Registering Background Services...')

        // Dynamic import to avoid bundling issues
        const { QueueWorker } = await import('@/lib/worker')
        QueueWorker.start()
    }
}
