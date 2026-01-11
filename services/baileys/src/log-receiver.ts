import { FastifyRequest, FastifyReply } from 'fastify'

interface LogEntry {
    level: 'info' | 'error' | 'warn' | 'debug'
    message: string
    context?: Record<string, any>
    timestamp?: number
    traceId?: string
    agentId?: number
    source?: string
    module?: string
}

interface LogBatchRequest {
    logs: LogEntry[]
}

/**
 * Log Ingestion Endpoint
 * Receives logs from Amplify backend and writes them to Pino logger
 */
export function setupLogIngestion(server: any) {
    // POST /api/logs/ingest - Receive logs from backend
    server.post('/api/logs/ingest', async (req: FastifyRequest<{ Body: LogBatchRequest }>, reply: FastifyReply) => {
        const { logs } = req.body

        if (!logs || !Array.isArray(logs)) {
            return reply.code(400).send({ error: 'Invalid payload: logs array required' })
        }

        // Process each log entry
        for (const log of logs) {
            const { level, message, context, timestamp, traceId, agentId, source, module } = log

            // Enrich log with metadata
            const enrichedContext = {
                ...context,
                traceId,
                agentId,
                source: source || 'amplify',
                module,
                timestamp: timestamp || Date.now()
            }

            // Write to Pino logger based on level
            switch (level) {
                case 'error':
                    server.log.error(enrichedContext, message)
                    break
                case 'warn':
                    server.log.warn(enrichedContext, message)
                    break
                case 'debug':
                    server.log.debug(enrichedContext, message)
                    break
                case 'info':
                default:
                    server.log.info(enrichedContext, message)
                    break
            }
        }

        return { success: true, processed: logs.length }
    })
}
