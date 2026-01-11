import axios from 'axios'
import { AsyncLocalStorage } from 'async_hooks'
import { prisma } from '@/lib/prisma'

// AsyncLocalStorage for trace context propagation
const traceStorage = new AsyncLocalStorage<TraceContext>()

interface TraceContext {
    traceId: string
    agentId?: number
}

interface LogContext {
    [key: string]: any
}

/**
 * Get log forwarding configuration from database
 */
async function getLogConfig() {
    try {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: ['log_forwarding_enabled', 'waha_endpoint', 'waha_api_key']
                }
            }
        })

        const config: Record<string, string> = {}
        settings.forEach(s => {
            config[s.key] = s.value
        })

        return {
            enabled: config.log_forwarding_enabled === 'true',
            endpoint: config.waha_endpoint || process.env.BAILEYS_LOG_ENDPOINT || null,
            apiKey: config.waha_api_key || process.env.AUTH_TOKEN || null
        }
    } catch (error) {
        // Fallback to env vars if DB is not available
        return {
            enabled: process.env.LOG_FORWARDING_ENABLED === 'true',
            endpoint: process.env.BAILEYS_LOG_ENDPOINT || null,
            apiKey: process.env.AUTH_TOKEN || null
        }
    }
}

/**
 * Centralized Logger with HTTP Forwarding to Baileys Server
 * 
 * Features:
 * - Logs locally (console.log for CloudWatch)
 * - Forwards to Baileys server (HTTP POST, non-blocking)
 * - Automatic retry with exponential backoff
 * - Trace ID propagation
 * - Dynamic configuration from database
 */
class Logger {
    private logBuffer: any[] = []
    private flushInterval: NodeJS.Timeout | null = null
    private maxRetries = 3
    private retryDelay = 100 // ms
    private isFlushingScheduled = false

    constructor() {
        // Start periodic flush check (every 2 seconds)
        this.flushInterval = setInterval(() => this.checkAndFlush(), 2000)
    }

    /**
     * Get current trace context
     */
    private getContext(): TraceContext | undefined {
        return traceStorage.getStore()
    }

    /**
     * Enrich log with trace context
     */
    private enrichContext(context?: LogContext): LogContext {
        const traceContext = this.getContext()
        return {
            ...context,
            traceId: traceContext?.traceId,
            agentId: traceContext?.agentId,
            timestamp: Date.now()
        }
    }

    /**
     * Log locally (console.log for CloudWatch)
     */
    private logLocally(level: string, message: string, context?: LogContext) {
        const enriched = this.enrichContext(context)
        const logLine = `[${level.toUpperCase()}] ${message} ${JSON.stringify(enriched)}`
        console.log(logLine)
    }

    /**
     * Add log to buffer for forwarding
     */
    private async addToBuffer(level: string, message: string, context?: LogContext) {
        // Just add to buffer, flush will check config dynamically
        const enriched = this.enrichContext(context)
        this.logBuffer.push({
            level,
            message,
            context: enriched,
            timestamp: enriched.timestamp,
            traceId: enriched.traceId,
            agentId: enriched.agentId,
            source: 'amplify'
        })

        console.log(`[DEBUG] Log buffered: ${message}, buffer size: ${this.logBuffer.length}`)

        // In serverless, flush immediately (Lambda may terminate before interval)
        await this.checkAndFlush()
    }

    /**
     * Check config and flush if enabled
     */
    private async checkAndFlush() {
        if (this.logBuffer.length === 0 || this.isFlushingScheduled) return
        this.isFlushingScheduled = true

        try {
            const config = await getLogConfig()
            console.log(`[DEBUG] Log config:`, config, `Buffer size: ${this.logBuffer.length}`)

            if (config.enabled && config.endpoint && config.apiKey) {
                console.log(`[DEBUG] Flushing ${this.logBuffer.length} logs to ${config.endpoint}`)
                await this.flush(config.endpoint, config.apiKey)
            } else {
                console.log(`[DEBUG] Forwarding disabled or missing config, clearing buffer`)
                // Clear buffer if forwarding is disabled
                this.logBuffer = []
            }
        } catch (error: any) {
            console.error(`[DEBUG] checkAndFlush error:`, error)
        } finally {
            this.isFlushingScheduled = false
        }
    }

    /**
     * Flush log buffer to Baileys server
     */
    private async flush(endpoint: string, apiKey: string) {
        if (this.logBuffer.length === 0) return

        const logsToSend = [...this.logBuffer]
        this.logBuffer = []

        console.log(`[DEBUG] Sending ${logsToSend.length} logs to ${endpoint}/api/logs/ingest`)

        try {
            await this.sendWithRetry(logsToSend, endpoint, apiKey)
            console.log(`[DEBUG] Logs sent successfully`)
        } catch (error: any) {
            console.error(`[DEBUG] Failed to send logs:`, error.message)
            // Silent fail - logs are already in CloudWatch
        }
    }

    /**
     * Send logs with retry logic
     */
    private async sendWithRetry(logs: any[], endpoint: string, apiKey: string, attempt = 1): Promise<void> {
        try {
            await axios.post(
                `${endpoint}/api/logs/ingest`,
                { logs },
                {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 5000
                }
            )
        } catch (error: any) {
            if (attempt < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1)
                await new Promise(resolve => setTimeout(resolve, delay))
                return this.sendWithRetry(logs, endpoint, apiKey, attempt + 1)
            }
            throw error
        }
    }

    /**
     * Public logging methods
     */
    async info(message: string, context?: LogContext) {
        this.logLocally('info', message, context)
        await this.addToBuffer('info', message, context)
    }

    async error(message: string, error?: Error, context?: LogContext) {
        const enrichedContext = {
            ...context,
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined
        }
        this.logLocally('error', message, enrichedContext)
        await this.addToBuffer('error', message, enrichedContext)
    }

    warn(message: string, context?: LogContext) {
        this.logLocally('warn', message, context)
        this.addToBuffer('warn', message, context)
    }

    debug(message: string, context?: LogContext) {
        this.logLocally('debug', message, context)
        this.addToBuffer('debug', message, context)
    }

    // Legacy compatibility
    log(message: string, data?: any) {
        this.info(message, data)
    }

    /**
     * Specialized logging methods
     */
    messageReceived(payload: any, agentId: number) {
        this.info('Message received from WhatsApp', {
            module: 'webhook',
            chatId: payload.from,
            messageType: payload.type,
            fromMe: payload.fromMe,
            agentId
        })
    }

    messageProcessing(step: string, context: LogContext) {
        this.info(`Processing: ${step}`, {
            module: 'processor',
            ...context
        })
    }

    messageSent(chatId: string, type: string, success: boolean, context?: LogContext) {
        this.info(`Message sent: ${type}`, {
            module: 'whatsapp',
            chatId,
            type,
            success,
            ...context
        })
    }

    aiCall(provider: string, model: string, duration: number, context?: LogContext) {
        this.info(`AI call completed`, {
            module: 'ai',
            provider,
            model,
            duration,
            ...context
        })
    }

    /**
     * Cleanup on shutdown
     */
    async shutdown() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval)
        }
        await this.checkAndFlush()
    }
}

/**
 * Trace ID Management
 */
export const trace = {
    /**
     * Generate a new trace ID (UUID v4)
     */
    generate(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    },

    /**
     * Get current trace context
     */
    getContext(): TraceContext | undefined {
        return traceStorage.getStore()
    },

    /**
     * Run function with trace context
     */
    run<T>(traceId: string, agentId: number | undefined, fn: () => T): T {
        return traceStorage.run({ traceId, agentId }, fn)
    },

    /**
     * Run async function with trace context
     */
    async runAsync<T>(traceId: string, agentId: number | undefined, fn: () => Promise<T>): Promise<T> {
        return traceStorage.run({ traceId, agentId }, fn)
    }
}

// Export singleton instance
export const logger = new Logger()

// Graceful shutdown
process.on('SIGTERM', async () => {
    await logger.shutdown()
})

process.on('SIGINT', async () => {
    await logger.shutdown()
})
