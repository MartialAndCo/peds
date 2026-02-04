
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[Instrumentation] Registering Background Services...')

        // QueueWorker: Disabled (using external CRON on EC2)
        console.log('[Instrumentation] Worker disabled (using external CRON)')

        // Initialize Supervisor (Queue Monitoring)
        const { initSupervisor } = await import('@/lib/services/supervisor')
        initSupervisor()
    }
}
