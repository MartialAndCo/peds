import { whatsapp } from '@/lib/whatsapp'

type QueueItem = {
    id: string
    chatId: string
    content: string | string[] // Can be a single string or array of parts
    type: 'text' | 'voice'
    file?: any // For voice/media
    resolve: (value: any) => void
    reject: (reason?: any) => void
}

class GlobalMessageQueue {
    private queues: Map<string, QueueItem[]> = new Map()
    private isProcessing: boolean = false
    private lastSentTime: number = 0
    private RATE_LIMIT_MS: number = 500 // Max 2 messages per second globally (safe)

    // Round Robin tracking
    private chatIds: string[] = []
    private currentChatIndex: number = 0

    constructor() {
        // Start processing loop
        // In Serverless/Next.js lambda, this might be tricky if the lambda freezes.
        // But for "Vercel" or "Amplify", usually the lambda runs while request is active.
        // Since we await the queue in the handler, the lambda stays alive.
    }

    async enqueueText(chatId: string, content: string | string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const item: QueueItem = {
                id: Math.random().toString(36).substring(7),
                chatId,
                content,
                type: 'text',
                resolve,
                reject
            }
            this.addToQueue(chatId, item)
            this.process()
        })
    }

    // Voice/Media support can be added similarly

    private addToQueue(chatId: string, item: QueueItem) {
        if (!this.queues.has(chatId)) {
            this.queues.set(chatId, [])
            this.chatIds.push(chatId)
        }
        this.queues.get(chatId)?.push(item)
    }

    private async process() {
        if (this.isProcessing) return
        this.isProcessing = true
        console.log('[Queue] Starting Process Loop')

        while (this.hasPendingItems()) {
            // 1. Rate Limit Check
            const now = Date.now()
            const timeSinceLast = now - this.lastSentTime
            if (timeSinceLast < this.RATE_LIMIT_MS) {
                await new Promise(r => setTimeout(r, this.RATE_LIMIT_MS - timeSinceLast))
            }

            // 2. Round Robin Selection
            const item = this.getNextItem()
            if (!item) break

            console.log(`[Queue] Processing item for ${item.chatId.substring(0, 10)}...`)

            // 3. Process Item
            try {
                if (item.type === 'text') {
                    const parts = Array.isArray(item.content) ? item.content : [item.content]

                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i]

                        // A. Simulate Typing
                        const typingDuration = Math.min(part.length * 60, 6000) + (Math.random() * 500)

                        // We wrap sendTyping in try/catch to avoid crashing if it fails
                        try { await whatsapp.sendTypingState(item.chatId, true) } catch (e) {
                            console.warn('[Queue] Typing failed, ignoring')
                        }
                        await new Promise(r => setTimeout(r, typingDuration))

                        // B. Send
                        console.log(`[Queue] Sending part ${i + 1}/${parts.length}`)
                        await whatsapp.sendText(item.chatId, part)
                        this.lastSentTime = Date.now()

                        // C. Pause
                        if (i < parts.length - 1) {
                            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
                        }
                    }
                }
                console.log(`[Queue] Item resolved`)
                item.resolve(true)
            } catch (e: any) {
                console.error('[Queue] Process Error:', e.message)
                item.reject(e)
            }
        }

        console.log('[Queue] Loop Finished')
        this.isProcessing = false
    }

    private hasPendingItems(): boolean {
        for (const q of this.queues.values()) {
            if (q.length > 0) return true
        }
        return false
    }

    private getNextItem(): QueueItem | null {
        if (this.chatIds.length === 0) return null

        // Round Robin
        let attempts = 0
        while (attempts < this.chatIds.length) {
            this.currentChatIndex = (this.currentChatIndex + 1) % this.chatIds.length
            const chatId = this.chatIds[this.currentChatIndex]
            const q = this.queues.get(chatId)

            if (q && q.length > 0) {
                return q.shift() || null
            }
            attempts++
        }
        return null
    }
}

// Singleton
export const messageQueue = new GlobalMessageQueue()
