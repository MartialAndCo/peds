import axios from 'axios'
import { AsyncLocalStorage } from 'async_hooks'

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
 * Centralized Logger with HTTP Forwarding to Baileys Server
 * 
 * Features:
 * - Logs locally (console.log for CloudWatch)
 * - Forwards to Baileys server (HTTP POST, non-blocking)
 * - Automatic retry with exponential backoff
 * - Trace ID propagation
 */
class Logger {
    private forwardingEnabled: boolean
    private baileysEndpoint: string | null
    private apiKey: string | null
    private logBuffer: any[] = []
    private flushInterval: NodeJS.Timeout | null = null
    private maxRetries = 3
    private retryDelay = 100 // ms

    constructor() {
        this.forwardingEnabled = process.env.LOG_FORWARDING_ENABLED === 'true'
        this.baileysEndpoint = process.env.BAILEYS_LOG_ENDPOINT || null
        this.apiKey = process.env.AUTH_TOKEN || null

        // Start flush interval (every 2 seconds or when buffer reaches 10 logs)
        if (this.forwardingEnabled && this.baileysEndpoint) {
            this.flushInterval = setInterval(() => this.flush(), 2000)
        }
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
    private addToBuffer(level: string, message: string, context?: LogContext) {
        if (!this.forwardingEnabled || !this.baileysEndpoint) return

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

        // Flush if buffer is full
        if (this.logBuffer.length >= 10) {
            this.flush()
        }
    }

    /**
     * Flush log buffer to Baileys server
     */
    private async flush() {
        if (this.logBuffer.length === 0) return
        if (!this.baileysEndpoint || !this.apiKey) return

        const logsToSend = [...this.logBuffer]
        this.logBuffer = []

        try {
            await this.sendWithRetry(logsToSend)
        } catch (error: any) {
            // Silent fail - logs are already in CloudWatch
            // console.error('[Logger] Failed to forward logs to Baileys:', error.message)
        }
    }

    /**
     * Send logs with retry logic
     */
    private async sendWithRetry(logs: any[], attempt = 1): Promise<void> {
        try {
            await axios.post(
                `${this.baileysEndpoint}/api/logs/ingest`,
                { logs },
                {
                    headers: { 'X-Api-Key': this.apiKey },
                    timeout: 5000
                }
            )
        } catch (error: any) {
            if (attempt < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1)
                await new Promise(resolve => setTimeout(resolve, delay))
                return this.sendWithRetry(logs, attempt + 1)
            }
            throw error
        }
    }

    /**
     * Public logging methods
     */
    info(message: string, context?: LogContext) {
        this.logLocally('info', message, context)
        this.addToBuffer('info', message, context)
    }

    error(message: string, error?: Error, context?: LogContext) {
        const enrichedContext = {
            ...context,
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined
        }
        this.logLocally('error', message, enrichedContext)
        this.addToBuffer('error', message, enrichedContext)
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
        await this.flush()
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
