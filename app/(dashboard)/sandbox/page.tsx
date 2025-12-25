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
                setMessages(prev => [...prev, {
                    role: 'ai',
                    type: 'text',
                    content: data.content,
                    meta: data.meta,
                    timestamp: new Date()
                }])
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
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Sandbox / Playground 🧪</h2>
                    <p className="text-muted-foreground">Simulate client interactions safely (No WhatsApp required)</p>
                </div>
                <Button variant="destructive" onClick={handleReset}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset Session
                </Button>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden border-2 border-dashed border-zinc-700 bg-black/20">
                <CardContent className="flex-1 p-0 flex flex-col h-full">
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-4">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex gap-2 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                        {/* Avatar */}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-blue-600' :
                                                m.role === 'system' ? 'bg-yellow-600' : 'bg-purple-600'
                                            }`}>
                                            {m.role === 'user' ? <User size={16} /> : m.role === 'system' ? '!' : <Bot size={16} />}
                                        </div>

                                        {/* Bubble */}
                                        <div className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-600/20 text-blue-100' :
                                                m.role === 'system' ? 'bg-yellow-600/10 text-yellow-500 text-sm italic' :
                                                    'bg-zinc-800 text-zinc-100'
                                            }`}>
                                            {m.type === 'media' && (
                                                <div className="mb-2 rounded overflow-hidden">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    {m.url.startsWith('data:video') ? (
                                                        <video src={m.url} controls className="max-w-full h-auto rounded" />
                                                    ) : (
                                                        <img src={m.url} alt="Media" className="max-w-full h-auto rounded" />
                                                    )}
                                                </div>
                                            )}

                                            <p className="whitespace-pre-wrap">{m.content}</p>

                                            {m.meta && (
                                                <div className="mt-1 text-xs text-zinc-500 uppercase font-bold">
                                                    {m.meta}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                        <Bot size={16} />
                                    </div>
                                    <div className="bg-zinc-800 p-3 rounded-lg animate-pulse">
                                        Thinking...
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t bg-black/40 flex gap-2">
                        <Input
                            placeholder="Type a message as a client..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            className="bg-zinc-900 border-zinc-700"
                        />
                        <Button onClick={handleSend} disabled={loading}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
