'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trash2, Send, Bot, User, Image as ImageIcon } from "lucide-react"

export default function SandboxPage() {
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Initial Greeting
    useEffect(() => {
        setMessages([{ role: 'system', content: 'Sandbox Environment Ready. Type a message to simulate a client.' }])
    }, [])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMsg = { role: 'user', content: input, timestamp: new Date() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setLoading(true)

        try {
            const res = await axios.post('/api/sandbox/message', { message: userMsg.content })
            const data = res.data

            if (data.type === 'media') {
                setMessages(prev => [...prev, {
                    role: 'ai',
                    type: 'media',
                    url: data.url,
                    content: `[Media sent: ${data.category}]`,
                    timestamp: new Date()
                }])
            } else {
                // Split logic for Sandbox visualization
                const rawContent = data.content || ""
                const parts = rawContent.split('|||').filter((p: string) => p.trim().length > 0)

                if (parts.length > 0) {
                    const newMessages = parts.map((part: string) => ({
                        role: 'ai',
                        type: 'text',
                        content: part.trim(),
                        meta: data.meta,
                        timestamp: new Date()
                    }))
                    setMessages(prev => [...prev, ...newMessages])
                }
            }

        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', content: 'Error communicating with Sandbox API', isError: true }])
        } finally {
            setLoading(false)
        }
    }

    const handleReset = async () => {
        if (!confirm('Reset Sandbox? This will delete the test contact and all memories.')) return
        try {
            await axios.post('/api/sandbox/reset')
            setMessages([{ role: 'system', content: 'Sandbox Reset Complete. Memory wiped.' }])
        } catch (e) {
            alert('Reset failed')
        }
    }

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col bg-background">
            {/* Header */}
            <div className="flex items-center justify-between py-4 border-b px-6 bg-background/95 backdrop-blur z-10">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">iMessage Sandbox</h2>
                    <p className="text-xs text-muted-foreground">Simulation Client • Instantané</p>
                </div>
                <Button
                    variant="ghost"
                    onClick={handleReset}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset
                </Button>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 px-4 py-6" ref={scrollRef}>
                <div className="space-y-4 max-w-3xl mx-auto">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[80%] px-4 py-2 text-[15px] leading-relaxed relative
                                ${m.role === 'user'
                                    ? 'bg-[#007AFF] text-white rounded-[20px] rounded-tr-[4px]'
                                    : m.role === 'system'
                                        ? 'bg-yellow-100 text-yellow-800 text-xs text-center mx-auto rounded-lg py-1'
                                        : 'bg-[#E9E9EB] dark:bg-[#262628] text-black dark:text-white rounded-[20px] rounded-tl-[4px]'
                                }
                                ${m.isError ? 'bg-red-100 text-red-600' : ''}
                            `}>
                                {/* Media Handling */}
                                {m.type === 'media' && (
                                    <div className="mb-2 rounded-lg overflow-hidden">
                                        {m.url.startsWith('data:video') ? (
                                            <video src={m.url} controls className="max-w-full h-auto rounded-lg" />
                                        ) : (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={m.url} alt="Media" className="max-w-full h-auto rounded-lg" />
                                        )}
                                    </div>
                                )}

                                {m.content}

                                {m.meta && (
                                    <div className="mt-1 text-[10px] opacity-50 uppercase font-bold tracking-wider pt-1 border-t border-black/10 dark:border-white/10">
                                        {m.meta}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-[#E9E9EB] dark:bg-[#262628] rounded-[20px] rounded-tl-[4px] px-4 py-3 flex items-center space-x-1 w-16 h-10">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-background border-t">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <div className="relative flex-1">
                        <Input
                            placeholder="iMessage"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            className="rounded-full border-[#C6C6C6] dark:border-[#3A3A3C] bg-transparent pl-4 pr-10 py-5 focus-visible:ring-0 focus-visible:border-[#007AFF]"
                        />
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className={`absolute right-1 top-1 bottom-1 rounded-full w-8 h-8 transition-all ${input.trim() ? 'bg-[#007AFF] hover:bg-[#007AFF]/90' : 'bg-transparent text-gray-400 hover:bg-transparent'
                                }`}
                        >
                            <Send size={14} className={input.trim() ? 'text-white' : ''} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
