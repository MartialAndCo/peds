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

import { useState, useRef, useEffect } from 'react'
import { useRouter } from "next/navigation"
import { ArrowLeft, Send, Info, Paperclip, Mic, MoreVertical, LogOut, ShieldAlert, Award } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

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
    const [infoOpen, setInfoOpen] = useState(false)

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
            {/* Instagram Style Header */}
            <header className="h-14 px-2 flex items-center justify-between bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] flex-shrink-0 pwa-safe-area-top-margin">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/10 -ml-1"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>

                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                                {conversation.contact.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <span className="text-white font-semibold text-sm">
                            {conversation.contact.name}
                        </span>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                    onClick={() => setInfoOpen(true)}
                >
                    <Info className="h-6 w-6" />
                </Button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0f172a]">
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
                                "max-w-[85%] px-4 py-2.5 rounded-[20px] text-[15px] leading-snug relative",
                                isMe
                                    ? "bg-[#3797f0] text-white" // Instagram Blue
                                    : "bg-[#262626] text-white" // Instagram Dark Grey
                            )}>
                                <p>{msg.message_text}</p>
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 pb-6 bg-[#0f172a] border-t border-white/10 flex items-end gap-3 pwa-safe-area-bottom">
                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-white/50">
                    <Paperclip className="h-5 w-5" />
                </div>

                <div className="flex-1 bg-[#262626] rounded-3xl flex items-center min-h-[44px] px-4 border border-white/5">
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Message..."
                        className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/40 h-auto py-3 text-[15px]"
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    />
                </div>

                {message.trim() ? (
                    <div
                        className="h-10 w-10 text-[#3797f0] font-semibold flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                        onClick={handleSend}
                    >
                        Send
                    </div>
                ) : (
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-white/50">
                        <Mic className="h-5 w-5" />
                    </div>
                )}
            </div>

            {/* Info Sheet (Replaces Context/Settings Header) */}
            <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
                <SheetContent className="bg-[#0f172a] border-white/10 text-white p-6 rounded-t-[30px] h-[70vh]">
                    <SheetHeader className="mb-8">
                        <div className="flex flex-col items-center">
                            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-4">
                                <span className="text-white font-bold text-3xl">
                                    {conversation.contact.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <SheetTitle className="text-2xl font-bold text-white mb-1">{conversation.contact.name}</SheetTitle>
                            <p className="text-white/50 font-mono text-sm">{conversation.contact.phone_whatsapp}</p>
                        </div>
                    </SheetHeader>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2">
                            <Award className="h-6 w-6 text-yellow-400" />
                            <span className="text-xs font-bold uppercase tracking-widest text-white/40">Score</span>
                            <span className="text-xl font-bold text-white">85</span>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2">
                            <ShieldAlert className="h-6 w-6 text-blue-400" />
                            <span className="text-xs font-bold uppercase tracking-widest text-white/40">Status</span>
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400">{conversation.status}</Badge>
                        </div>
                    </div>

                    <div className="mt-8 space-y-3">
                        <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest px-1">Actions</h3>
                        <Button variant="outline" className="w-full justify-start h-14 rounded-xl bg-white/5 border-white/5 hover:bg-white/10 text-white">
                            <LogOut className="mr-3 h-5 w-5 text-white/50" />
                            Export Conversation
                        </Button>
                        <Button variant="outline" className="w-full justify-start h-14 rounded-xl bg-white/5 border-white/5 hover:bg-white/10 text-white">
                            <ShieldAlert className="mr-3 h-5 w-5 text-white/50" />
                            Report / Block
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
