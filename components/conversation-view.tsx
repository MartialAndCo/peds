'use client'

import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Pause, Play, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConversationViewProps {
    conversationId: number
    initialData: any
}

export function ConversationView({ conversationId, initialData }: ConversationViewProps) {
    const [conversation, setConversation] = useState(initialData)
    const [messages, setMessages] = useState<any[]>([])
    const [inputText, setInputText] = useState('')
    const [sending, setSending] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Polling for messages
    useEffect(() => {
        fetchMessages()
        const interval = setInterval(fetchMessages, 3000) // Poll every 3s
        return () => clearInterval(interval)
    }, [conversationId])

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`/api/conversations/${conversationId}/messages`)
            setMessages(res.data)

            // Also refresh conversation status if needed
            const convRes = await axios.get(`/api/conversations/${conversationId}`)
            setConversation(convRes.data)
        } catch (error) {
            console.error('Polling error', error)
        }
    }

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
            fetchMessages()
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

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
            {/* Chat Area (Left/Middle) */}
            <Card className="md:col-span-2 flex flex-col h-full">
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
                <CardContent className="flex-1 p-0 overflow-hidden relative">
                    <div className="h-full overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                        {messages.length === 0 && <p className="text-center text-gray-400">No messages yet</p>}
                        {messages.map((m) => {
                            const isMe = m.sender === 'admin'
                            const isAi = m.sender === 'ai'
                            const isContact = m.sender === 'contact'

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
            <div className="space-y-4 h-full overflow-y-auto">
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
