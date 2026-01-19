import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from "next/navigation"
import { ArrowLeft, Send, Info, Paperclip, Mic, MoreVertical, LogOut, ShieldAlert, Award, FileText, Activity, Zap } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateContactStatus, updateConversationAi, updateContactTestMode, getExportData } from '@/app/actions/conversation'
import { generateDossier } from '@/lib/pdf-generator'

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
    const [isPending, startTransition] = useTransition()

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

    const [dragOffset, setDragOffset] = useState(0)
    const touchStart = useRef<{ x: number, y: number } | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStart.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStart.current) return
        const currentX = e.touches[0].clientX
        const currentY = e.touches[0].clientY

        const diffX = touchStart.current.x - currentX
        const diffY = Math.abs(touchStart.current.y - currentY)

        // If vertical scroll is dominant, don't drag
        if (diffY > diffX) return

        // Only allow dragging left (positive diff) up to 80px
        // Trigger threshold: must move at least 30px horizontally to start effect
        if (diffX > 30 && diffX < 80) {
            setDragOffset(diffX)
        }
    }

    const handleTouchEnd = () => {
        touchStart.current = null
        setDragOffset(0)
    }

    const formatDateHeader = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    // Toggle Handlers
    const toggleStatus = (checked: boolean) => {
        startTransition(async () => {
            await updateContactStatus(conversation.contactId, checked ? 'active' : 'paused')
        })
    }

    const toggleAi = (checked: boolean) => {
        startTransition(async () => {
            await updateConversationAi(conversation.id, checked)
        })
    }

    const toggleTestMode = (checked: boolean) => {
        startTransition(async () => {
            await updateContactTestMode(conversation.contactId, checked)
        })
    }

    const handleExport = async () => {
        const data = await getExportData(conversation.id)
        generateDossier(data)
    }

    // Calculated fields
    const daysActive = Math.floor((new Date().getTime() - new Date(conversation.contact.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    const isContactActive = conversation.contact.status === 'active'

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0f172a] fixed inset-0 z-[60]">
            {/* Instagram Style Header */}
            <header className="h-16 px-4 flex items-center justify-between bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] flex-shrink-0 z-50 sticky top-0 pwa-safe-area-top-margin">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/10 -ml-2 rounded-full h-10 w-10"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-white/20 flex items-center justify-center shadow-lg">
                                <span className="text-white text-sm font-bold">
                                    {conversation.contact.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-[#0f172a] rounded-full"></div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-sm tracking-wide leading-none">
                                {conversation.contact.name}
                            </span>
                            <span className="text-white/40 text-[10px] uppercase font-medium tracking-wider mt-0.5">
                                Active Now
                            </span>
                        </div>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 rounded-full h-10 w-10"
                    onClick={() => setInfoOpen(true)}
                >
                    <Info className="h-6 w-6" />
                </Button>
            </header>

            {/* Chat Area */}
            <div
                className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0f172a] overflow-x-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className="transition-transform duration-200 ease-out will-change-transform"
                    style={{ transform: `translateX(-${dragOffset}px)` }}
                >
                    {conversation.messages?.map((msg: any, index: number) => {
                        const isMe = msg.sender !== 'contact'
                        const prevMsg = conversation.messages[index - 1]
                        const showTimeHeader = !prevMsg || (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 1000 * 60 * 60) // 1 hour gap

                        return (
                            <div key={msg.id} className="flex flex-col w-full relative">
                                {showTimeHeader && (
                                    <div className="flex justify-center my-4">
                                        <span className="text-white/30 text-[10px] uppercase font-bold tracking-widest bg-white/5 px-2 py-1 rounded-full">
                                            {formatDateHeader(msg.timestamp)}
                                        </span>
                                    </div>
                                )}
                                <div
                                    className={cn(
                                        "flex w-full mb-1 items-end relative group",
                                        isMe ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className={cn(
                                        "max-w-[75%] px-5 py-3 rounded-[22px] text-[15px] leading-[1.3] relative shadow-md transition-all",
                                        isMe
                                            ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-none"
                                            : "bg-[#1e293b] text-white rounded-bl-none border border-white/5"
                                    )}>
                                        <p>{msg.message_text}</p>
                                    </div>
                                </div>
                                {/* Swipe Timestamp (Revealed on Right) */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 right-[-60px] flex items-center justify-center transition-opacity duration-300"
                                    style={{ opacity: dragOffset > 20 ? 1 : 0 }}
                                >
                                    <span className="text-[10px] font-bold text-white/40">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-3 pb-20 pt-2 bg-[#0f172a] border-t border-white/5 flex items-end gap-2 pwa-safe-area-bottom">

                <div className="flex-1 bg-[#1a1a1a] rounded-[24px] flex items-center min-h-[48px] px-1 border border-white/5 transition-all focus-within:border-blue-500/50">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-blue-500 cursor-pointer active:scale-90 transition-transform">
                        <Paperclip className="h-5 w-5" />
                    </div>
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Message..."
                        className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30 h-auto py-3 text-[16px]"
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    />
                    {!message.trim() && (
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-white/40">
                            <Mic className="h-5 w-5" />
                        </div>
                    )}
                </div>

                {message.trim() && (
                    <div
                        className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/40 active:scale-95 transition-all cursor-pointer"
                        onClick={handleSend}
                    >
                        <Send className="h-5 w-5 text-white ml-0.5" />
                    </div>
                )}
            </div>

            {/* Info Sheet (Replaces Context/Settings Header) */}
            <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
                <SheetContent side="right" className="bg-[#0f172a] border-none text-white w-full max-w-full p-0 h-full z-[100] overflow-y-auto sm:max-w-full">
                    <div className="p-6">
                        <SheetHeader className="mb-8 relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-0 top-0 text-white hover:bg-white/10 -ml-2 rounded-full"
                                onClick={() => setInfoOpen(false)}
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                            <SheetDescription className="hidden">Contact Details</SheetDescription>
                            <div className="flex flex-col items-center pt-2">
                                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-4">
                                    <span className="text-white font-bold text-3xl">
                                        {conversation.contact.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <SheetTitle className="text-2xl font-bold text-white mb-1">{conversation.contact.name}</SheetTitle>
                                <p className="text-white/50 font-mono text-sm">{conversation.contact.phone_whatsapp}</p>
                            </div>
                        </SheetHeader>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2">
                                <Award className="h-6 w-6 text-yellow-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Trust Score</span>
                                <span className="text-xl font-bold text-white">{conversation.contact.trustScore}</span>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2">
                                <Activity className="h-6 w-6 text-blue-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Phase</span>
                                <Badge variant="outline" className="border-blue-500/30 text-blue-400 uppercase text-[10px]">
                                    {conversation.contact.agentPhase}
                                </Badge>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 col-span-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Jours d'activité</span>
                                <span className="text-xl font-bold text-white">{daysActive} Jours</span>
                            </div>
                        </div>

                        {/* Toggles Section */}
                        <div className="space-y-6 mb-8">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <Label className="text-white font-medium text-base">Statut Actif</Label>
                                    <span className="text-xs text-white/40">Mettre en pause ou activer</span>
                                </div>
                                <Switch
                                    checked={isContactActive}
                                    onCheckedChange={toggleStatus}
                                    disabled={isPending}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <Label className="text-white font-medium text-base">IA Réponse</Label>
                                    <span className="text-xs text-white/40">L'IA répond automatiquement</span>
                                </div>
                                <Switch
                                    checked={conversation.ai_enabled}
                                    onCheckedChange={toggleAi}
                                    disabled={isPending}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <Label className="text-white font-medium text-base">Mode Test (Fast)</Label>
                                    <span className="text-xs text-white/40">Réponses immédiates (No delay)</span>
                                </div>
                                <Switch
                                    checked={conversation.contact.testMode}
                                    onCheckedChange={toggleTestMode}
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest px-1">Actions</h3>
                            <Button
                                variant="outline"
                                className="w-full justify-start h-14 rounded-xl bg-white/5 border-white/5 hover:bg-white/10 text-white"
                                onClick={handleExport}
                            >
                                <FileText className="mr-3 h-5 w-5 text-white/50" />
                                Export PDF Dossier
                            </Button>
                            <Button variant="outline" className="w-full justify-start h-14 rounded-xl bg-white/5 border-white/5 hover:bg-white/10 text-white">
                                <ShieldAlert className="mr-3 h-5 w-5 text-white/50" />
                                Report / Block
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div >
    )
}
