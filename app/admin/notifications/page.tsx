'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X, Clock, DollarSign, ArrowLeft, Loader2, RefreshCw, Mic, Play, Pause, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from "@/components/ui/use-toast"
import { motion, AnimatePresence, PanInfo } from 'framer-motion'

interface Notification {
    id: string
    title: string
    message: string
    type: string
    entityId: string
    metadata: any
    isRead: boolean
    createdAt: string
}

export default function NotificationsPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [processingAction, setProcessingAction] = useState<'confirm' | 'reject' | 'wait' | null>(null)

    useEffect(() => {
        fetchNotifications()
    }, [])

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications?limit=50')
            const data = await res.json()
            if (data.notifications) {
                setNotifications(data.notifications)
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (notification: Notification, action: 'confirm' | 'reject' | 'wait') => {
        if (action === 'wait') {
            router.push('/admin')
            return
        }

        setProcessingId(notification.id)
        setProcessingAction(action)
        try {
            const res = await fetch(`/api/claims/${notification.entityId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })

            const result = await res.json()

            if (res.ok && result.success) {
                toast({
                    title: action === 'confirm' ? "Payment Confirmed" : "Payment Rejected",
                    description: action === 'confirm' ? "AI has been notified to thank the user." : "AI will tell user money was not received.",
                    variant: action === 'confirm' ? "default" : "destructive"
                })

                fetchNotifications()
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n))
            } else {
                throw new Error(result.error || 'Failed')
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process action. Try again.",
                variant: "destructive"
            })
        } finally {
            setProcessingId(null)
            setProcessingAction(null)
        }
    }

    // Handle TTS failure notifications (Continue = shy refusal, Pause = pause conversation)
    const handleTtsAction = async (notification: Notification, action: 'continue' | 'pause') => {
        setProcessingId(notification.id)
        // Reuse state or add new one? For simplicity reusing logic variable logic locally if needed, but strictly we need specific action tracking for TTS too if we want perfect spinner. 
        // For now, let's keep TTS simple as user complained about Payment buttons.
        try {
            const res = await fetch('/api/notifications/tts-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: notification.id, action })
            })

            const result = await res.json()

            if (res.ok && result.success) {
                toast({
                    title: action === 'continue' ? "Shy Refusal Sent" : "Conversation Paused",
                    description: action === 'continue'
                        ? "AI refused the voice note naturally."
                        : "Conversation has been paused.",
                    variant: action === 'pause' ? "destructive" : "default"
                })

                fetchNotifications()
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n))
            } else {
                throw new Error(result.error || 'Failed')
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process action. Try again.",
                variant: "destructive"
            })
        } finally {
            setProcessingId(null)
        }
    }

    const markAllRead = async () => {
        await fetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ markAllRead: true }) })
        fetchNotifications()
    }

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to delete all notifications?')) return

        try {
            await fetch('/api/notifications?all=true', { method: 'DELETE' })
            setNotifications([])
            toast({ title: "Deleted", description: "All notifications cleared." })
        } catch (error) {
            console.error(error)
        }
    }

    const handleSwipeDelete = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.filter(n => n.id !== id))

        try {
            await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
        } catch (error) {
            console.error('Failed to delete', error)
            fetchNotifications() // Revert on error
        }
    }

    return (
        <div className="min-h-screen bg-[#0f172a] pb-20 overflow-x-hidden">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/10 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60 hover:text-white hover:bg-white/10 -ml-2">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-xl font-bold text-white tracking-tight">Notification Center</h1>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={handleClearAll} className="text-red-400 hover:text-red-300 hover:bg-white/5">
                        <Trash2 className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={fetchNotifications} className="text-white/40 hover:text-white">
                        <RefreshCw className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-20 text-white/30 flex flex-col items-center">
                        <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <Bell className="h-8 w-8 opacity-40" />
                        </div>
                        <p className="font-medium">All caught up!</p>
                        <p className="text-sm opacity-60 mt-1">No new alerts.</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {notifications.map(n => {
                            const isPayment = n.type === 'PAYMENT_CLAIM';
                            const isTtsFailure = n.type === 'TTS_FAILURE';
                            // Construct better message for Payment
                            // Metadata: amount, method, contactName
                            const amount = n.metadata?.amount || '?'
                            const method = n.metadata?.method || 'unknown method'
                            const sender = n.metadata?.contactName || 'Someone'
                            const cleanMethod = method === 'AI_DETECTED' ? 'AI' : method;
                            const ttsText = n.metadata?.originalText || ''

                            return (
                                <motion.div
                                    key={n.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    onDragEnd={(_, info: PanInfo) => {
                                        if (info.offset.x < -100 || info.offset.x > 100) {
                                            handleSwipeDelete(n.id)
                                        }
                                    }}
                                    className="relative touch-pan-y"
                                >
                                    {/* Background Hint for Delete */}
                                    {/* <div className="absolute inset-0 flex items-center justify-between px-6 bg-red-500/20 rounded-3xl -z-10">
                                        <Trash2 className="h-6 w-6 text-red-400" />
                                        <Trash2 className="h-6 w-6 text-red-400" />
                                    </div> */}

                                    <div className={cn(
                                        "rounded-3xl p-5 border transition-all relative overflow-hidden group select-none cursor-grab active:cursor-grabbing",
                                        n.isRead ? "bg-white/5 border-white/5 opacity-60" : "bg-[#1e293b] border-white/10 shadow-lg shadow-black/20"
                                    )}>
                                        {!n.isRead && <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}

                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                                                isPayment ? "bg-emerald-500/10 text-emerald-400"
                                                    : isTtsFailure ? "bg-amber-500/10 text-amber-400"
                                                        : "bg-blue-500/10 text-blue-400"
                                            )}>
                                                {isPayment ? <DollarSign className="h-6 w-6" />
                                                    : isTtsFailure ? <Mic className="h-6 w-6" />
                                                        : <Bell className="h-6 w-6" />}
                                            </div>

                                            <div className="flex-1 space-y-1">
                                                <div className="flex justify-between items-start pr-4">
                                                    <h3 className="text-white font-bold text-base tracking-tight">
                                                        {isPayment ? "Payment Claim" : isTtsFailure ? "🎤 Voice Note Failed" : n.title}
                                                    </h3>
                                                </div>

                                                {isPayment ? (
                                                    <div className="text-white/80 text-sm leading-relaxed">
                                                        <span className="font-semibold text-white">{sender}</span> claims to have sent <span className="font-bold text-emerald-400">{amount === '?' ? 'money' : amount}</span>
                                                        {cleanMethod && cleanMethod !== 'unknown method' && cleanMethod !== 'AI' && (
                                                            <> via <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-white/10 text-white/60">{cleanMethod}</Badge></>
                                                        )}
                                                        .
                                                    </div>
                                                ) : isTtsFailure ? (
                                                    <div className="text-white/80 text-sm leading-relaxed space-y-3">
                                                        <div className="bg-black/30 rounded-xl p-3 space-y-2">
                                                            <p className="text-white/50 text-xs font-medium uppercase tracking-wide">📋 Conversation:</p>
                                                            <div className="text-white/70 text-xs space-y-1 whitespace-pre-line">
                                                                {n.message.split('\n').filter(line => line.startsWith('🤖') || line.startsWith('👤')).slice(0, 5).map((line, i) => (
                                                                    <p key={i} className={line.startsWith('🤖') ? 'text-blue-300' : 'text-white/60'}>{line}</p>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {ttsText && (
                                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                                                                <p className="text-amber-400/80 text-xs font-medium mb-1">🗣️ Texte à dire:</p>
                                                                <p className="text-white/80 text-sm italic">"{ttsText}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-white/60 text-sm">{n.message}</p>
                                                )}

                                                <p className="text-white/20 text-xs font-mono pt-1">
                                                    {new Date(n.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        {isPayment && !n.isRead && (
                                            <div className="mt-5 flex flex-col gap-3">
                                                <Button
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-12 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all w-full"
                                                    onClick={() => handleAction(n, 'confirm')}
                                                    disabled={!!processingId}
                                                    onPointerDownCapture={e => e.stopPropagation()} // Prevent drag
                                                >
                                                    {processingId === n.id && processingAction === 'confirm' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5 mr-2" />}
                                                    ✓ Yes, Received
                                                </Button>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        variant="outline"
                                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 h-12 rounded-xl"
                                                        onClick={() => handleAction(n, 'reject')}
                                                        disabled={!!processingId}
                                                        onPointerDownCapture={e => e.stopPropagation()}
                                                    >
                                                        {processingId === n.id && processingAction === 'reject' ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5 mr-1" />}
                                                        ✗ Not Received
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        className="text-white/40 hover:text-white hover:bg-white/5 h-12 rounded-xl"
                                                        onClick={() => handleAction(n, 'wait')}
                                                        disabled={!!processingId}
                                                        onPointerDownCapture={e => e.stopPropagation()}
                                                    >
                                                        Wait
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {isTtsFailure && !n.isRead && (
                                            <div className="mt-5 grid grid-cols-2 gap-3">
                                                <Button
                                                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-11 rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all"
                                                    onClick={() => handleTtsAction(n, 'continue')}
                                                    disabled={!!processingId}
                                                    onPointerDownCapture={e => e.stopPropagation()}
                                                >
                                                    {processingId === n.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 mr-2" />}
                                                    Continue (Shy Text)
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 h-11 rounded-xl"
                                                    onClick={() => handleTtsAction(n, 'pause')}
                                                    disabled={!!processingId}
                                                    onPointerDownCapture={e => e.stopPropagation()}
                                                >
                                                    <Pause className="h-5 w-5 mr-1" />
                                                    Pause Conv
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </div>

            {!loading && notifications.length > 0 && (
                <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={markAllRead}
                        className="pointer-events-auto shadow-xl bg-[#1e293b] border border-white/10 text-white/60 hover:text-white rounded-full px-6"
                    >
                        Mark all as read
                    </Button>
                </div>
            )}
        </div>
    )
}
