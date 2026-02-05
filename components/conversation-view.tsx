'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Send, Bot, User, Pause, Play, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AudioPlayer } from '@/components/chat/audio-player'
import { getExportData } from '@/app/actions/conversation'
import { generateDossier } from '@/lib/pdf-generator'
import { FileDown, FileText } from 'lucide-react'

interface ConversationViewProps {
    conversationId: number
    initialData: any
}

interface Message {
    id: number
    sender: string
    message_text: string
    mediaUrl?: string | null
    timestamp: string
}

export function ConversationView({ conversationId, initialData }: ConversationViewProps) {
    const [conversation, setConversation] = useState(initialData)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [sending, setSending] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [oldestId, setOldestId] = useState<number | null>(null)
    const [initialLoad, setInitialLoad] = useState(true)
    const [exporting, setExporting] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const prevScrollHeight = useRef<number>(0)

    // Helper to fix base64 URLs that were stored without proper data URI prefix
    const fixMediaUrl = (url: string | null | undefined): string | null => {
        if (!url) return null
        
        // Fix raw base64 data that was stored without proper data URI prefix
        if (url.startsWith('/9j/')) {
            return `data:image/jpeg;base64,${url}`
        }
        if (url.startsWith('iVBOR')) {
            return `data:image/png;base64,${url}`
        }
        if (url.startsWith('R0lGOD')) {
            return `data:image/gif;base64,${url}`
        }
        if (url.startsWith('UklGR')) {
            return `data:image/webp;base64,${url}`
        }
        return url
    }

    // Initial load - get latest messages
    useEffect(() => {
        loadInitialMessages()
    }, [conversationId])

    // Poll for new messages (only newest ones)
    useEffect(() => {
        const interval = setInterval(pollNewMessages, 3000)
        return () => clearInterval(interval)
    }, [conversationId, messages])

    // Scroll to bottom on initial load
    useEffect(() => {
        if (initialLoad && messages.length > 0 && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            setInitialLoad(false)
        }
    }, [messages, initialLoad])

    const loadInitialMessages = async () => {
        try {
            const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=50`)
            setMessages(res.data.messages || [])
            setHasMore(res.data.hasMore)
            setOldestId(res.data.oldestId)

            // Also refresh conversation status
            const convRes = await axios.get(`/api/conversations/${conversationId}`)
            setConversation(convRes.data)
        } catch (error) {
            console.error('Initial load error', error)
        }
    }

    const pollNewMessages = async () => {
        if (messages.length === 0) return

        try {
            // Get latest messages and merge any new ones
            const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=20`)
            const newMessages = res.data.messages || []

            // Find messages that are newer than our newest
            const newestId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) : 0
            const trulyNew = newMessages.filter((m: Message) => m.id > newestId)

            if (trulyNew.length > 0) {
                setMessages(prev => [...prev, ...trulyNew])
                // Auto-scroll to bottom for new messages if already near bottom
                if (scrollRef.current) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
                    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
                    if (isNearBottom) {
                        setTimeout(() => {
                            scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight
                        }, 50)
                    }
                }
            }

            // Also refresh conversation status
            const convRes = await axios.get(`/api/conversations/${conversationId}`)
            setConversation(convRes.data)
        } catch (error) {
            console.error('Polling error', error)
        }
    }

    const loadOlderMessages = async () => {
        if (!hasMore || loadingMore || !oldestId) return

        setLoadingMore(true)
        prevScrollHeight.current = scrollRef.current?.scrollHeight || 0

        try {
            const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=30&before=${oldestId}`)
            const olderMessages = res.data.messages || []

            if (olderMessages.length > 0) {
                setMessages(prev => [...olderMessages, ...prev])
                setHasMore(res.data.hasMore)
                setOldestId(res.data.oldestId)

                // Maintain scroll position after prepending
                setTimeout(() => {
                    if (scrollRef.current) {
                        const newScrollHeight = scrollRef.current.scrollHeight
                        scrollRef.current.scrollTop = newScrollHeight - prevScrollHeight.current
                    }
                }, 10)
            } else {
                setHasMore(false)
            }
        } catch (error) {
            console.error('Load more error', error)
        } finally {
            setLoadingMore(false)
        }
    }

    // Handle scroll to detect when user scrolls near top
    const handleScroll = useCallback(() => {
        if (!scrollRef.current || loadingMore || !hasMore) return

        if (scrollRef.current.scrollTop < 100) {
            loadOlderMessages()
        }
    }, [loadingMore, hasMore, oldestId])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputText.trim()) return

        setSending(true)
        try {
            await axios.post(`/api/conversations/${conversationId}/send`, {
                message_text: inputText,
                sender: 'admin'
            })
            setInputText('')
            // Immediate refresh to show sent message
            pollNewMessages()
        } catch (error) {
            console.error(error)
            alert('Failed to send')
        } finally {
            setSending(false)
        }
    }

    const toggleAI = async () => {
        try {
            const newState = !conversation.ai_enabled
            await axios.put(`/api/conversations/${conversationId}`, { ai_enabled: newState })
            setConversation({ ...conversation, ai_enabled: newState })
        } catch (e) {
            alert('Error toggling AI')
        }
    }

    const toggleStatus = async () => {
        try {
            const newStatus = conversation.status === 'active' ? 'paused' : 'active'
            await axios.put(`/api/conversations/${conversationId}`, { status: newStatus })
            setConversation({ ...conversation, status: newStatus })
        } catch (e) {
            alert('Error changing status')
        }
    }

    const toggleFastMode = async () => {
        try {
            const newTestMode = !conversation.contact.testMode
            await axios.put(`/api/contacts/${conversation.contact.id}`, { testMode: newTestMode })
            setConversation({
                ...conversation,
                contact: { ...conversation.contact, testMode: newTestMode }
            })
        } catch (e) {
            alert('Error toggling Fast Mode')
        }
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await getExportData(conversationId)
            await generateDossier(data)
        } catch (e) {
            console.error("Export Failed", e)
            alert("Export Failed: " + String(e))
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full max-h-full">
            {/* Chat Area (Left/Middle) */}
            <Card className="md:flex-[2] flex flex-col h-full min-h-0">
                <CardHeader className="flex flex-row items-center justify-between py-3 border-b">
                    <CardTitle className="text-lg flex items-center">
                        <User className="mr-2 h-5 w-5" />
                        {conversation.contact.name} ({conversation.contact.phone_whatsapp})
                    </CardTitle>
                    <div className="flex gap-2">
                        <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                            {conversation.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-0 overflow-hidden relative">
                    <div
                        className="h-full overflow-y-auto p-4 space-y-4"
                        ref={scrollRef}
                        onScroll={handleScroll}
                    >
                        {/* Loading indicator at top */}
                        {loadingMore && (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                        )}

                        {/* "Load more" hint */}
                        {hasMore && !loadingMore && messages.length > 0 && (
                            <div className="text-center text-xs text-gray-400 py-2">
                                ↑ Scroll up for older messages
                            </div>
                        )}

                        {!hasMore && messages.length > 0 && (
                            <div className="text-center text-xs text-gray-400 py-2">
                                — Beginning of conversation —
                            </div>
                        )}

                        {messages.length === 0 && !loadingMore && (
                            <p className="text-center text-gray-400">No messages yet</p>
                        )}

                        {messages.map((m) => {
                            const isMe = m.sender === 'admin'
                            const isAi = m.sender === 'ai'
                            const isContact = m.sender === 'contact'

                            // Media Detection
                            const fixedMediaUrl = fixMediaUrl(m.mediaUrl)
                            const isImage = fixedMediaUrl && (fixedMediaUrl.startsWith('data:image') || fixedMediaUrl.match(/\.(jpeg|jpg|gif|png)$/i) || m.mediaUrl?.startsWith('/9j/') || m.mediaUrl?.startsWith('iVBOR'))
                            const isVideo = fixedMediaUrl && (fixedMediaUrl.startsWith('data:video') || fixedMediaUrl.match(/\.(mp4|mov)$/i))
                            const isAudio = fixedMediaUrl && (fixedMediaUrl.startsWith('data:audio') || fixedMediaUrl.match(/\.(mp3|wav|ogg)$/i))

                            return (
                                <div key={m.id} className={cn("flex w-full",
                                    isContact ? "justify-start" : "justify-end"
                                )}>
                                    <div className={cn(
                                        "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                                        isContact ? "bg-gray-200 text-black" :
                                            isAi ? "bg-blue-100 text-blue-900 border border-blue-200" :
                                                "bg-green-600 text-white"
                                    )}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold opacity-70 capitalize">{m.sender}</span>
                                            <span className="text-[10px] opacity-50">{new Date(m.timestamp).toLocaleTimeString()}</span>
                                        </div>

                                        {/* Media Rendering */}
                                        {isImage && fixedMediaUrl && (
                                            <div className="mb-2 mt-1">
                                                <a href={fixedMediaUrl} target="_blank" rel="noopener noreferrer">
                                                    <img src={fixedMediaUrl} alt="Shared Media" className="max-w-full rounded-md max-h-64 object-cover" />
                                                </a>
                                            </div>
                                        )}
                                        {isVideo && fixedMediaUrl && (
                                            <div className="mb-2 mt-1">
                                                <video src={fixedMediaUrl} controls className="max-w-full rounded-md max-h-64" />
                                            </div>
                                        )}
                                        {isAudio && fixedMediaUrl && (
                                            <div className="mb-2 mt-1">
                                                <AudioPlayer src={fixedMediaUrl} isMe={isMe} />
                                            </div>
                                        )}

                                        <p className="whitespace-pre-wrap">{m.message_text}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
                <CardFooter className="p-3 border-t">
                    <form onSubmit={handleSend} className="flex gap-2 w-full">
                        <Input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type a message..."
                            disabled={sending}
                        />
                        <Button type="submit" disabled={sending}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            {/* Controls Area (Right) */}
            <div className="md:flex-[1] space-y-4 h-full overflow-y-auto min-h-0">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleExport}
                            disabled={exporting}
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                            {exporting ? "Generating PDF..." : "Export Dossier PDF"}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="ai-toggle">AI Response</Label>
                            <Switch id="ai-toggle" checked={conversation.ai_enabled} onCheckedChange={toggleAI} />
                        </div>
                        <p className="text-xs text-gray-500">
                            {conversation.ai_enabled ? "AI is responding automatically." : "AI is disabled. Reply manually."}
                        </p>

                        <div className="border-t pt-4 flex items-center justify-between">
                            <Label>Status</Label>
                            <Button size="sm" variant="outline" onClick={toggleStatus}>
                                {conversation.status === 'active' ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                {conversation.status === 'active' ? 'Pause' : 'Resume'}
                            </Button>
                        </div>

                        <div className="border-t pt-4 flex items-center justify-between">
                            <div>
                                <Label htmlFor="fast-mode-toggle">⚡ Fast Mode</Label>
                                <p className="text-xs text-gray-500 mt-1">
                                    {conversation.contact.testMode ? "Réponses en 3-8s" : "Timing naturel"}
                                </p>
                            </div>
                            <Switch
                                id="fast-mode-toggle"
                                checked={conversation.contact.testMode || false}
                                onCheckedChange={toggleFastMode}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Agent State</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div>
                            <span className="font-semibold block mb-1">Trust Score:</span>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-lg font-bold",
                                    (conversation.contact.trustScore || 0) < 50 ? "text-red-500" : "text-green-500"
                                )}>
                                    {conversation.contact.trustScore || 0}
                                </span>
                                <span className="text-xs text-muted-foreground">/ 100</span>
                            </div>
                        </div>
                        <div>
                            <span className="font-semibold block mb-1">Phase:</span>
                            <Badge variant="outline" className={cn(
                                conversation.contact.agentPhase === 'CRISIS' ? "border-red-500 text-red-500" :
                                    conversation.contact.agentPhase === 'VULNERABILITY' ? "border-yellow-500 text-yellow-600" :
                                        "border-blue-500 text-blue-500"
                            )}>
                                {conversation.contact.agentPhase || 'CONNECTION'}
                            </Badge>
                        </div>
                        <div>
                            <span className="font-semibold block">Days Active:</span>
                            {Math.ceil(Math.abs(new Date().getTime() - new Date(conversation.contact.createdAt).getTime()) / (1000 * 60 * 60 * 24))} Days
                        </div>
                        <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">Temperature:</span>
                                <span className="font-mono">{conversation.prompt.temperature}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div>
                            <span className="font-semibold block">Prompt:</span>
                            {conversation.prompt.name}
                        </div>
                        <div>
                            <span className="font-semibold block">Model:</span>
                            {conversation.prompt.model}
                        </div>
                        <div>
                            <span className="font-semibold block">Source:</span>
                            {conversation.contact.source || '-'}
                        </div>
                        <div>
                            <span className="font-semibold block">Notes:</span>
                            <p className="text-gray-500 italic">{conversation.contact.notes || 'No notes'}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
