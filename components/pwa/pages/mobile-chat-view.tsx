'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from "next/navigation"
import { ArrowLeft, Send, Phone, MoreVertical, Paperclip, Mic } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
// import { format } from "date-fns" // Assuming date-fns is available

interface MobileChatViewProps {
    conversation: any
    agentId: string
    onSendMessage: (text: string) => Promise<void>
}

export function MobileChatView({ conversation, agentId, onSendMessage }: MobileChatViewProps) {
    const router = useRouter()
    const [message, setMessage] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [sending, setSending] = useState(false)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [conversation.messages])

    const handleSend = async () => {
        if (!message.trim() || sending) return
        setSending(true)
        try {
            await onSendMessage(message)
            setMessage('')
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0f172a] fixed inset-0 z-[60]">
            {/* Minimal Header */}
            <header className="h-14 px-2 flex items-center justify-between bg-[#0f172a]/90 backdrop-blur-xl border-b border-white/[0.06] flex-shrink-0 pwa-safe-area-top-margin">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-400 -ml-1"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                                {conversation.contact.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-semibold text-sm leading-tight">
                                {conversation.contact.name}
                            </span>
                            <span className="text-white/40 text-[10px leading-tight">
                                WhatsApp
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center">
                    <Button variant="ghost" size="icon" className="text-blue-400">
                        <Phone className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#0f172a] to-black/40">
                {conversation.messages?.map((msg: any) => {
                    const isMe = msg.from_me
                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full mb-2",
                                isMe ? "justify-end" : "justify-start"
                            )}
                        >
                            <div className={cn(
                                "max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed relative shadow-sm",
                                isMe
                                    ? "bg-blue-600 text-white rounded-tr-sm"
                                    : "bg-[#1e293b] text-white rounded-tl-sm border border-white/5"
                            )}>
                                <p>{msg.message_text}</p>
                                <span className={cn(
                                    "text-[10px] block text-right mt-1 opacity-60",
                                    isMe ? "text-blue-100" : "text-slate-400"
                                )}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-2 pb-6 bg-[#0f172a] border-t border-white/10 flex items-end gap-2 pwa-safe-area-bottom">
                <Button variant="ghost" size="icon" className="text-white/40 mb-1">
                    <Paperclip className="h-6 w-6" />
                </Button>

                <div className="flex-1 bg-white/10 rounded-2xl flex items-center min-h-[44px] px-2 mb-1">
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Message..."
                        className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30 h-auto py-2.5 max-h-32"
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    />
                </div>

                {message.trim() ? (
                    <Button
                        size="icon"
                        className="rounded-full bg-blue-600 hover:bg-blue-500 text-white mb-1 transition-all"
                        onClick={handleSend}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" className="text-white/40 mb-1">
                        <Mic className="h-6 w-6" />
                    </Button>
                )}
            </div>
        </div>
    )
}
